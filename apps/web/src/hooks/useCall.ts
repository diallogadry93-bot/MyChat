'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'

export interface CallParticipant {
  userId:     string
  stream?:    MediaStream
  audioMuted: boolean
  videoOff:   boolean
}

interface UseCallOptions {
  socket:        Socket | null
  currentUserId: string
  onCallEnded?:  () => void
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TURN server configured via env in production
  ...(process.env['NEXT_PUBLIC_TURN_URL'] ? [{
    urls:       process.env['NEXT_PUBLIC_TURN_URL'],
    username:   process.env['NEXT_PUBLIC_TURN_USER'] ?? '',
    credential: process.env['NEXT_PUBLIC_TURN_PASS'] ?? '',
  }] : []),
]

export function useCall({ socket, currentUserId, onCallEnded }: UseCallOptions) {
  const [callState,    setCallState]    = useState<CallState>('idle')
  const [callId,       setCallId]       = useState<string | null>(null)
  const [callType,     setCallType]     = useState<'voice' | 'video'>('voice')
  const [participants, setParticipants] = useState<Map<string, CallParticipant>>(new Map())
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null)
  const [audioMuted,   setAudioMuted]   = useState(false)
  const [videoOff,     setVideoOff]     = useState(false)
  const [screenSharing, setScreenSharing] = useState(false)

  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const screenStreamRef = useRef<MediaStream | null>(null)

  // ── Get user media ──────────────────────────────────────
  const getLocalStream = useCallback(async (video: boolean): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
    })
    localStreamRef.current = stream
    setLocalStream(stream)
    return stream
  }, [])

  // ── Create RTCPeerConnection for a remote peer ──────────
  const createPeerConnection = useCallback((remoteUserId: string, cId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!)
    })

    // ICE candidate relay via socket
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit('call:ice', { callId: cId, targetUserId: remoteUserId, candidate })
      }
    }

    // Incoming remote track
    pc.ontrack = ({ streams }) => {
      const [remoteStream] = streams
      setParticipants(prev => {
        const next = new Map(prev)
        const p    = next.get(remoteUserId) ?? { userId: remoteUserId, audioMuted: false, videoOff: false }
        next.set(remoteUserId, { ...p, stream: remoteStream })
        return next
      })
    }

    pc.onconnectionstatechange = () => {
      console.info(`PeerConnection ${remoteUserId}: ${pc.connectionState}`)
      if (pc.connectionState === 'connected') setCallState('connected')
    }

    peerConnections.current.set(remoteUserId, pc)
    return pc
  }, [socket])

  // ── Initiate call ───────────────────────────────────────
  const startCall = useCallback(async (
    chatId: string,
    type: 'voice' | 'video',
    accessToken: string,
  ): Promise<string | null> => {
    try {
      setCallType(type)
      setCallState('calling')
      await getLocalStream(type === 'video')

      const res = await fetch('/api/calls', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body:    JSON.stringify({ chatId, callType: type }),
      })
      const { callId: newCallId } = await res.json() as { callId: string }

      setCallId(newCallId)
      socket?.emit('call:join', newCallId)
      return newCallId
    } catch (err) {
      console.error('Failed to start call:', err)
      setCallState('idle')
      return null
    }
  }, [getLocalStream, socket])

  // ── Answer incoming call ────────────────────────────────
  const answerCall = useCallback(async (
    incomingCallId: string,
    type: 'voice' | 'video',
  ): Promise<void> => {
    setCallId(incomingCallId)
    setCallType(type)
    setCallState('connected')
    await getLocalStream(type === 'video')
    socket?.emit('call:join', incomingCallId)
  }, [getLocalStream, socket])

  // ── End call ────────────────────────────────────────────
  const endCall = useCallback(async (accessToken?: string): Promise<void> => {
    if (callId && accessToken) {
      await fetch(`/api/calls/${callId}/end`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(console.error)
    }

    // Cleanup
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    screenStreamRef.current?.getTracks().forEach(t => t.stop())
    peerConnections.current.forEach(pc => pc.close())
    peerConnections.current.clear()

    socket?.emit('call:leave', callId ?? '')
    setCallState('ended')
    setLocalStream(null)
    setParticipants(new Map())
    setCallId(null)
    onCallEnded?.()

    // Reset to idle after brief ended state
    setTimeout(() => setCallState('idle'), 1500)
  }, [callId, socket, onCallEnded])

  // ── Toggle audio ────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = audioMuted })
    setAudioMuted(m => {
      socket?.emit('call:media-state', { callId: callId ?? '', audio: m, video: !videoOff })
      return !m
    })
  }, [audioMuted, videoOff, callId, socket])

  // ── Toggle video ────────────────────────────────────────
  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff })
    setVideoOff(v => {
      socket?.emit('call:media-state', { callId: callId ?? '', audio: !audioMuted, video: v })
      return !v
    })
  }, [videoOff, audioMuted, callId, socket])

  // ── Screen share ────────────────────────────────────────
  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop())
      // Restore camera
      const camTrack = localStreamRef.current?.getVideoTracks()[0]
      if (camTrack) {
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          sender?.replaceTrack(camTrack).catch(console.error)
        })
      }
      setScreenSharing(false)
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screenStream
        const screenTrack = screenStream.getVideoTracks()[0]!
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          sender?.replaceTrack(screenTrack).catch(console.error)
        })
        screenTrack.onended = () => { void toggleScreenShare() }
        setScreenSharing(true)
      } catch (err) {
        console.error('Screen share failed:', err)
      }
    }
  }, [screenSharing])

  // ── Socket event listeners ──────────────────────────────
  useEffect(() => {
    if (!socket) return

    // Incoming call offer
    socket.on('call:offer', (data: Record<string, unknown>) => {
      const { callId: incomingId, callType: type, initiator } = data as {
        callId: string; callType: 'voice' | 'video'; initiator: { id: string }
      }
      if (initiator.id === currentUserId) return // own call
      setCallId(incomingId)
      setCallType(type)
      setCallState('ringing')
    })

    // ICE candidates from remote peers
    socket.on('call:ice', (data: Record<string, unknown>) => {
      const { fromUserId, candidate } = data as { fromUserId: string; candidate: RTCIceCandidateInit }
      const pc = peerConnections.current.get(fromUserId)
      pc?.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error)
    })

    // Participant joined → create offer
    socket.on('call:participant-joined', async ({ callId: cId, userId: remoteId }: { callId: string; userId: string }) => {
      if (remoteId === currentUserId) return
      setParticipants(prev => {
        const next = new Map(prev)
        if (!next.has(remoteId)) next.set(remoteId, { userId: remoteId, audioMuted: false, videoOff: false })
        return next
      })
      // Create peer connection and send offer
      const pc    = createPeerConnection(remoteId, cId)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:ice', { callId: cId, targetUserId: remoteId, sdp: offer })
    })

    // Participant left
    socket.on('call:participant-left', ({ userId: remoteId }: { userId: string }) => {
      peerConnections.current.get(remoteId)?.close()
      peerConnections.current.delete(remoteId)
      setParticipants(prev => { const next = new Map(prev); next.delete(remoteId); return next })
    })

    // Remote media state changed
    socket.on('call:media-state', ({ userId: remoteId, audio, video }: { callId: string; userId: string; audio: boolean; video: boolean }) => {
      setParticipants(prev => {
        const next = new Map(prev)
        const p    = next.get(remoteId)
        if (p) next.set(remoteId, { ...p, audioMuted: !audio, videoOff: !video })
        return next
      })
    })

    // Call ended
    socket.on('call:end', () => { void endCall() })

    return () => {
      socket.off('call:offer')
      socket.off('call:ice')
      socket.off('call:participant-joined')
      socket.off('call:participant-left')
      socket.off('call:media-state')
      socket.off('call:end')
    }
  }, [socket, currentUserId, createPeerConnection, endCall])

  return {
    callState, callId, callType,
    participants: Array.from(participants.values()),
    localStream, audioMuted, videoOff, screenSharing,
    startCall, answerCall, endCall,
    toggleAudio, toggleVideo, toggleScreenShare,
  }
}
