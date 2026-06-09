'use client'
import { useState } from 'react'

interface Props {
  messageId:   string
  accessToken: string
  onTranslated: (text: string) => void
}

const LANGUAGES = [
  { code: 'Spanish',    flag: '🇪🇸' },
  { code: 'French',     flag: '🇫🇷' },
  { code: 'German',     flag: '🇩🇪' },
  { code: 'Arabic',     flag: '🇸🇦' },
  { code: 'Chinese',    flag: '🇨🇳' },
  { code: 'Japanese',   flag: '🇯🇵' },
  { code: 'Portuguese', flag: '🇧🇷' },
  { code: 'Russian',    flag: '🇷🇺' },
]

export function TranslateButton({ messageId, accessToken, onTranslated }: Props) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  const translate = async (language: string) => {
    setLoading(true)
    setOpen(false)
    try {
      const res = await fetch('/api/ai/translate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body:    JSON.stringify({ messageId, targetLanguage: language }),
      })
      const data = await res.json() as { translated: string }
      onTranslated(data.translated)
      setDone(true)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  if (done) return (
    <button
      onClick={() => { setDone(false); onTranslated('') }}
      className="text-[10px] text-primary-400 hover:text-primary-600 transition"
    >
      Show original
    </button>
  )

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="text-[10px] text-gray-400 hover:text-primary-500 transition flex items-center gap-1"
        title="Translate message"
      >
        {loading
          ? <span className="w-2.5 h-2.5 border border-gray-300 border-t-primary-500 rounded-full animate-spin" />
          : '🌐'
        }
        Translate
      </button>

      {open && (
        <div className="absolute bottom-5 left-0 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2 w-44">
          <p className="text-[10px] text-gray-400 px-2 pb-1 font-medium uppercase">Translate to</p>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { void translate(lang.code) }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 transition"
            >
              <span>{lang.flag}</span>
              {lang.code}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
