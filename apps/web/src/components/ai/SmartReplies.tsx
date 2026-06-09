'use client'
import { useCallback, useEffect, useState } from 'react'

interface Reply { text: string; tone: string }

interface Props {
  chatId:      string
  accessToken: string
  onSelect:    (text: string) => void
  lastMessageAt: string | null  // re-fetch when new message arrives
}

const TONE_ICONS: Record<string, string> = {
  friendly: '😊',
  formal:   '🤝',
  brief:    '⚡',
}

export function SmartReplies({ chatId, accessToken, onSelect, lastMessageAt }: Props) {
  const [replies,  setReplies]  = useState<Reply[]>([])
  const [loading,  setLoading]  = useState(false)
  const [visible,  setVisible]  = useState(true)

  const fetchReplies = useCallback(async () => {
    if (!chatId || !accessToken) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/smart-replies', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body:    JSON.stringify({ chatId }),
      })
      const data = await res.json() as { replies: Reply[] }
      setReplies(data.replies ?? [])
      setVisible(true)
    } catch {
      setReplies([])
    } finally {
      setLoading(false)
    }
  }, [chatId, accessToken])

  // Re-fetch when a new message arrives
  useEffect(() => {
    if (lastMessageAt) void fetchReplies()
  }, [lastMessageAt, fetchReplies])

  if (!visible || (replies.length === 0 && !loading)) return null

  return (
    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center gap-2 flex-wrap">
        {loading ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-3 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
            Thinking…
          </div>
        ) : (
          <>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mr-1">✨ Suggestions</span>
            {replies.map((r, i) => (
              <button
                key={i}
                onClick={() => { onSelect(r.text); setVisible(false) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition shadow-sm"
              >
                <span>{TONE_ICONS[r.tone] ?? '💬'}</span>
                {r.text}
              </button>
            ))}
            <button
              onClick={() => setVisible(false)}
              className="text-[10px] text-gray-300 hover:text-gray-500 transition ml-auto"
              title="Dismiss"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  )
}
