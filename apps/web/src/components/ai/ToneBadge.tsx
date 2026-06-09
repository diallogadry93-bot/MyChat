'use client'
import { useCallback, useState } from 'react'

type ToneLabel = 'friendly' | 'formal' | 'tense' | 'urgent' | 'neutral'

interface Props {
  messageId:   string
  text:        string
  accessToken: string
}

const TONE_CONFIG: Record<ToneLabel, { icon: string; color: string; label: string }> = {
  friendly: { icon: '😊', color: 'text-green-500',  label: 'Friendly' },
  formal:   { icon: '🤝', color: 'text-blue-500',   label: 'Formal'   },
  tense:    { icon: '😤', color: 'text-orange-500', label: 'Tense'    },
  urgent:   { icon: '🚨', color: 'text-red-500',    label: 'Urgent'   },
  neutral:  { icon: '💬', color: 'text-gray-400',   label: 'Neutral'  },
}

export function ToneBadge({ messageId, text, accessToken }: Props) {
  const [tone,    setTone]    = useState<ToneLabel | null>(null)
  const [loading, setLoading] = useState(false)
  const [shown,   setShown]   = useState(false)

  const fetchTone = useCallback(async () => {
    if (tone || loading || text.length < 20) return
    setLoading(true)
    try {
      const res = await fetch('/api/ai/tone', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body:    JSON.stringify({ text }),
      })
      const data = await res.json() as { tone: ToneLabel }
      setTone(data.tone)
      setShown(true)
    } catch { /* silent fail */ }
    finally { setLoading(false) }
  }, [tone, loading, text, accessToken])

  if (text.length < 20) return null

  const config = tone ? TONE_CONFIG[tone] : null

  return (
    <span
      onMouseEnter={() => { void fetchTone() }}
      className="inline-flex items-center gap-1 text-[10px] cursor-default select-none"
      title={config ? `Tone: ${config.label}` : 'Hover to detect tone'}
    >
      {loading && <span className="w-2.5 h-2.5 border border-gray-300 border-t-gray-500 rounded-full animate-spin" />}
      {shown && config && (
        <span className={`${config.color} transition-opacity`}>
          {config.icon} {config.label}
        </span>
      )}
    </span>
  )
}
