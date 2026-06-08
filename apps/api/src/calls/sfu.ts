/**
 * MyChat SFU — mediasoup-based Selective Forwarding Unit
 *
 * Architecture:
 *  - 1-on-1 calls: browser WebRTC peer-to-peer (no SFU needed, lower latency)
 *  - Group calls (3+ participants): mediasoup SFU
 *    Each participant sends ONE stream UP to the SFU.
 *    SFU fans it out to all other participants — no full-mesh needed.
 *
 * Rooms:
 *  - One Room per active call (keyed by callId)
 *  - Each participant has a Transport (send + recv)
 *  - Producers: outgoing tracks (audio/video)
 *  - Consumers: incoming tracks from other participants
 */

import type { types as MediasoupTypes } from 'mediasoup'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SfuParticipant {
  userId:          string
  sendTransport?:  MediasoupTypes.WebRtcTransport
  recvTransport?:  MediasoupTypes.WebRtcTransport
  producers:       Map<string, MediasoupTypes.Producer>
  consumers:       Map<string, MediasoupTypes.Consumer>
}

export interface SfuRoom {
  callId:       string
  chatId:       string
  router:       MediasoupTypes.Router
  participants: Map<string, SfuParticipant>
  createdAt:    Date
}

// ── Codecs ───────────────────────────────────────────────────────────────────

export const MEDIA_CODECS: MediasoupTypes.RtpCodecCapability[] = [
  {
    kind:      'audio',
    mimeType:  'audio/opus',
    clockRate: 48000,
    channels:  2,
  },
  {
    kind:        'video',
    mimeType:    'video/VP8',
    clockRate:   90000,
    parameters:  { 'x-google-start-bitrate': 1000 },
  },
  {
    kind:       'video',
    mimeType:   'video/VP9',
    clockRate:  90000,
    parameters: { 'profile-id': 2, 'x-google-start-bitrate': 1000 },
  },
  {
    kind:       'video',
    mimeType:   'video/h264',
    clockRate:  90000,
    parameters: {
      'packetization-mode':      1,
      'profile-level-id':        '4d0032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate':  1000,
    },
  },
]

// ── WebRTC transport options ──────────────────────────────────────────────────

export const WEBRTC_TRANSPORT_OPTIONS: MediasoupTypes.WebRtcTransportOptions = {
  listenIps: [
    {
      ip:           process.env['MEDIASOUP_LISTEN_IP']          ?? '0.0.0.0',
      announcedIp: process.env['MEDIASOUP_ANNOUNCED_IP'] ?? '127.0.0.1',
    },
  ],
  enableUdp:        true,
  enableTcp:        true,
  preferUdp:        true,
  initialAvailableOutgoingBitrate: 1_000_000,
  minimumAvailableOutgoingBitrate:   600_000,
  maxSctpMessageSize:              262144,
}

// ── Room manager ─────────────────────────────────────────────────────────────

export class SfuRoomManager {
  private rooms = new Map<string, SfuRoom>()
  private worker: MediasoupTypes.Worker | null = null

  async init(): Promise<void> {
    // Lazy-import mediasoup to avoid crash if native binary not compiled yet
    try {
      const mediasoup = await import('mediasoup')
      this.worker = await mediasoup.createWorker({
        logLevel:   'warn',
        logTags:    ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        rtcMinPort: parseInt(process.env['MEDIASOUP_RTC_MIN_PORT'] ?? '40000'),
        rtcMaxPort: parseInt(process.env['MEDIASOUP_RTC_MAX_PORT'] ?? '49999'),
      })
      this.worker.on('died', (error) => {
        console.error('mediasoup worker died:', error)
        setTimeout(() => { void this.init() }, 2000)
      })
      console.info('✅ mediasoup worker started')
    } catch (err) {
      console.warn('⚠️  mediasoup not available (will work when deployed):', (err as Error).message)
    }
  }

  async getOrCreateRoom(callId: string, chatId: string): Promise<SfuRoom | null> {
    if (this.rooms.has(callId)) return this.rooms.get(callId)!
    if (!this.worker) return null

    const router = await this.worker.createRouter({ mediaCodecs: MEDIA_CODECS })
    const room: SfuRoom = {
      callId, chatId, router,
      participants: new Map(),
      createdAt:    new Date(),
    }
    this.rooms.set(callId, room)
    console.info(`📞 SFU room created: ${callId}`)
    return room
  }

  getRoom(callId: string): SfuRoom | undefined {
    return this.rooms.get(callId)
  }

  async createWebRtcTransport(room: SfuRoom): Promise<MediasoupTypes.WebRtcTransport> {
    return room.router.createWebRtcTransport(WEBRTC_TRANSPORT_OPTIONS)
  }

  async joinRoom(room: SfuRoom, userId: string): Promise<SfuParticipant> {
    const participant: SfuParticipant = {
      userId,
      producers: new Map(),
      consumers: new Map(),
    }
    room.participants.set(userId, participant)
    return participant
  }

  async closeRoom(callId: string): Promise<void> {
    const room = this.rooms.get(callId)
    if (!room) return
    room.router.close()
    this.rooms.delete(callId)
    console.info(`📞 SFU room closed: ${callId}`)
  }

  async leaveRoom(callId: string, userId: string): Promise<void> {
    const room = this.rooms.get(callId)
    if (!room) return

    const participant = room.participants.get(userId)
    if (!participant) return

    participant.producers.forEach(p => p.close())
    participant.consumers.forEach(c => c.close())
    participant.sendTransport?.close()
    participant.recvTransport?.close()
    room.participants.delete(userId)

    if (room.participants.size === 0) {
      await this.closeRoom(callId)
    }
  }

  getRoomParticipants(callId: string): string[] {
    return Array.from(this.rooms.get(callId)?.participants.keys() ?? [])
  }

  isAvailable(): boolean {
    return this.worker !== null
  }
}

export const sfuManager = new SfuRoomManager()
