'use client'
import { VideoTile }    from './VideoTile'
import { CallControls } from './CallControls'
import type { CallParticipant, CallState } from '@/hooks/useCall'

interface Props {
  callState:     CallState
  callType:      'voice' | 'video'
  callId:        string | null
  participants:  CallParticipant[]
  localStream:   MediaStream | null
  audioMuted:    boolean
  videoOff:      boolean
  screenSharing: boolean
  currentUser:   { id: string; displayName: string }
  onToggleAudio:  () => void
  onToggleVideo:  () => void
  onScreenShare:  () => void
  onEndCall:      () => void
  onAnswer:       () => void
  onDecline:      () => void
}

export function CallView({
  callState, callType, participants, localStream,
  audioMuted, videoOff, screenSharing, currentUser,
  onToggleAudio, onToggleVideo, onScreenShare, onEndCall, onAnswer, onDecline,
}: Props) {

  // ── Ringing screen ───────────────────────────────────────
  if (callState === 'ringing') {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950/95 flex items-center justify-center backdrop-blur-sm">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-primary-500 flex items-center justify-center text-4xl mx-auto mb-6 animate-pulse">
            {callType === 'video' ? '📹' : '📞'}
          </div>
          <p className="text-white text-xl font-semibold mb-2">Incoming {callType} call</p>
          <p className="text-gray-400 text-sm mb-8">Someone is calling you</p>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={onDecline}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white text-2xl transition"
            >
              📵
            </button>
            <button
              onClick={onAnswer}
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white text-2xl transition animate-bounce"
            >
              📞
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Calling / connecting screen ──────────────────────────
  if (callState === 'calling') {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950/95 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-primary-500 flex items-center justify-center text-4xl mx-auto mb-6">
            {callType === 'video' ? '📹' : '📞'}
          </div>
          <p className="text-white text-xl font-semibold mb-2">Calling…</p>
          <div className="flex justify-center gap-1 mb-8">
            {[0,1,2].map(i => (
              <span key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i*150}ms` }} />
            ))}
          </div>
          <button
            onClick={onEndCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white text-2xl transition"
          >
            📵
          </button>
        </div>
      </div>
    )
  }

  // ── Ended screen ─────────────────────────────────────────
  if (callState === 'ended') {
    return (
      <div className="fixed inset-0 z-50 bg-gray-950/95 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl font-semibold">Call ended</p>
        </div>
      </div>
    )
  }

  // ── Active call ──────────────────────────────────────────
  if (callState !== 'connected') return null

  const allTiles = [
    { participant: { userId: currentUser.id, audioMuted, videoOff, stream: localStream ?? undefined }, isLocal: true },
    ...participants.map(p => ({ participant: p, isLocal: false })),
  ]

  const gridCols = allTiles.length <= 1 ? 'grid-cols-1'
    : allTiles.length <= 2 ? 'grid-cols-2'
    : allTiles.length <= 4 ? 'grid-cols-2'
    : 'grid-cols-3'

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-white text-sm font-medium">
            {callType === 'video' ? 'Video' : 'Voice'} call · {allTiles.length} participant{allTiles.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-gray-400 text-xs">🔒 Encrypted</span>
      </div>

      {/* Video grid */}
      <div className={`flex-1 grid ${gridCols} gap-2 p-4 overflow-hidden`}>
        {allTiles.map(({ participant: p, isLocal }) => (
          <VideoTile
            key={p.userId}
            stream={p.stream ?? null}
            displayName={isLocal ? currentUser.displayName : p.userId}
            isLocal={isLocal}
            audioMuted={p.audioMuted}
            videoOff={p.videoOff}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="border-t border-gray-800 bg-gray-900">
        <CallControls
          audioMuted={audioMuted}
          videoOff={videoOff}
          screenSharing={screenSharing}
          callType={callType}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onScreenShare={onScreenShare}
          onEndCall={onEndCall}
        />
      </div>
    </div>
  )
}
