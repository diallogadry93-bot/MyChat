'use client'
import { useState } from 'react'

interface SummaryResult {
  bullets:   string[]
  timeRange: string
  count:     number
}

interface Props {
  chatId:      string
  accessToken: string
  unreadCount: number
}

export function ChatSummary({ chatId, accessToken, unreadCount }: Props) {
  const [summary,  setSummary]  = useState<SummaryResult | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [visible,  setVisible]  = useState(false)
  const [error,    setError]    = useState('')

  if (unreadCount < 10) return null

  const fetchSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ai/summary/${chatId}?limit=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json() as { summary: SummaryResult | null; reason?: string }
      if (data.summary) {
        setSummary(data.summary)
        setVisible(true)
      } else {
        setError(data.reason ?? 'Could not summarise')
      }
    } catch {
      setError('Failed to get summary')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-4 mt-3">
      {!visible ? (
        <button
          onClick={() => { void fetchSummary() }}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 text-sm font-medium hover:bg-primary-100 transition disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
              Summarising {unreadCount} messages…
            </>
          ) : (
            <>✨ Catch me up — {unreadCount} unread messages</>
          )}
        </button>
      ) : summary ? (
        <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-primary-600 text-sm">✨</span>
              <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">
                Summary · {summary.timeRange}
              </span>
            </div>
            <button
              onClick={() => setVisible(false)}
              className="text-primary-400 hover:text-primary-600 text-xs transition"
            >
              ✕ Close
            </button>
          </div>
          <ul className="space-y-2">
            {summary.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                <span className="text-primary-400 mt-0.5 flex-shrink-0">•</span>
                {bullet}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-primary-400 mt-3">
            Based on {summary.count} messages · AI-generated summary
          </p>
        </div>
      ) : error ? (
        <p className="text-center text-xs text-red-400 py-2">{error}</p>
      ) : null}
    </div>
  )
}
