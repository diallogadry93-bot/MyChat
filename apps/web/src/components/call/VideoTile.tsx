'use client'
import { useEffect, useRef } from 'react'

interface Props {
  stream:      MediaStream | null
  displayName: string
  isLocal?:    boolean
  audioMuted:  boolean
  videoOff:    boolean
  isSpeaking?: boolean
}

export function VideoTile({ stream, displayName, isLocal, audioMuted, videoOff, isSpeaking }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-gray-900 aspect-video flex items-center justify-center ${
      isSpeaking ? 'ring-2 ring-green-400' : ''
    }`}>
      {/* Video */}
      {stream && !videoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          {videoOff && <p className="text-xs text-gray-400">Camera off</p>}
        </div>
      )}

      {/* Name badge */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
          {isLocal ? 'You' : displayName}
        </span>
        {audioMuted && (
          <span className="bg-red-500/80 text-white text-xs px-1.5 py-0.5 rounded-full">🔇</span>
        )}
      </div>

      {/* Local mirror indicator */}
      {isLocal && (
        <span className="absolute top-2 right-2 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
          You
        </span>
      )}
    </div>
  )
}
