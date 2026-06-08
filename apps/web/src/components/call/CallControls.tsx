'use client'

interface Props {
  audioMuted:    boolean
  videoOff:      boolean
  screenSharing: boolean
  callType:      'voice' | 'video'
  onToggleAudio:  () => void
  onToggleVideo:  () => void
  onScreenShare:  () => void
  onEndCall:      () => void
}

export function CallControls({
  audioMuted, videoOff, screenSharing, callType,
  onToggleAudio, onToggleVideo, onScreenShare, onEndCall,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      {/* Mic */}
      <button
        onClick={onToggleAudio}
        className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition ${
          audioMuted
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-white'
        }`}
        title={audioMuted ? 'Unmute' : 'Mute'}
      >
        {audioMuted ? '🔇' : '🎤'}
      </button>

      {/* Camera (only for video calls) */}
      {callType === 'video' && (
        <button
          onClick={onToggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition ${
            videoOff
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={videoOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {videoOff ? '📷' : '📹'}
        </button>
      )}

      {/* Screen share */}
      <button
        onClick={onScreenShare}
        className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition ${
          screenSharing
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-white'
        }`}
        title={screenSharing ? 'Stop sharing' : 'Share screen'}
      >
        🖥️
      </button>

      {/* End call */}
      <button
        onClick={onEndCall}
        className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xl transition shadow-lg"
        title="End call"
      >
        📵
      </button>
    </div>
  )
}
