'use client'
import { useRef, useState, useCallback } from 'react'

interface Props {
  onSend: (text: string, selfDestructSeconds?: number) => void
  onTypingStart: () => void
  onTypingStop: () => void
  disabled?: boolean
}

const SELF_DESTRUCT_OPTIONS = [
  { label: 'Off',    value: undefined },
  { label: '5s',     value: 5 },
  { label: '30s',    value: 30 },
  { label: '1 min',  value: 60 },
  { label: '5 min',  value: 300 },
  { label: '1 hr',   value: 3600 },
]

export function MessageInput({ onSend, onTypingStart, onTypingStop, disabled }: Props) {
  const [text, setText]               = useState('')
  const [selfDestruct, setSelfDestruct] = useState<number | undefined>(undefined)
  const [showTimer, setShowTimer]     = useState(false)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>()

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)

    // Typing indicator debounce
    onTypingStart()
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(onTypingStop, 2000)

    // Auto-resize textarea
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, selfDestruct)
    setText('')
    clearTimeout(typingTimer.current)
    onTypingStop()
  }, [text, selfDestruct, disabled, onSend, onTypingStop])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      {/* Self-destruct timer picker */}
      {showTimer && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-gray-500">💣 Self-destruct:</span>
          {SELF_DESTRUCT_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => { setSelfDestruct(opt.value); setShowTimer(false) }}
              className={`text-xs px-3 py-1 rounded-full transition ${
                selfDestruct === opt.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3">
        {/* Self-destruct toggle */}
        <button
          onClick={() => setShowTimer(s => !s)}
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition ${
            selfDestruct
              ? 'bg-orange-100 text-orange-600'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'
          }`}
          title="Self-destruct timer"
        >
          💣
        </button>

        {/* Text input */}
        <textarea
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Message… (Shift+Enter for new line)"
          className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition disabled:opacity-50 max-h-40 overflow-y-auto"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="Send (Enter)"
        >
          <svg className="w-4 h-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 21L23 12 2 3v7l15 2-15 2v7z"/>
          </svg>
        </button>
      </div>

      {selfDestruct && (
        <p className="text-xs text-orange-500 mt-2">
          ⏱ Messages will disappear after {SELF_DESTRUCT_OPTIONS.find(o => o.value === selfDestruct)?.label}
        </p>
      )}
    </div>
  )
}
