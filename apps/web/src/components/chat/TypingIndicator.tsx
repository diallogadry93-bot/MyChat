'use client'

interface Props { names: string[] }

export function TypingIndicator({ names }: Props) {
  if (names.length === 0) return null

  const label = names.length === 1
    ? `${names[0]} is typing`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names.length} people are typing`

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <span>{label}…</span>
    </div>
  )
}
