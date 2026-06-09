'use client'
import { useState } from 'react'
import { ToneBadge }       from '@/components/ai/ToneBadge'
import { TranslateButton } from '@/components/ai/TranslateButton'

interface Reaction  { emoji: string; userId: string }
interface Attachment { id: string; storageKey: string; mimeType: string; sizeBytes: number }

interface Message {
  id: string; senderId: string; type: string; bodyEncrypted: string
  editedAt: string | null; selfDestructAt: string | null; createdAt: string
  reactions: Reaction[]; attachments: Attachment[]
  sender: { id: string; displayName: string; avatarUrl: string | null }
}

interface Props {
  message:     Message
  isOwn:       boolean
  accessToken: string
  onReact:     (messageId: string, emoji: string) => void
  onEdit?:     (message: Message) => void
  onDelete?:   (messageId: string) => void
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function MessageBubble({ message, isOwn, accessToken, onReact, onEdit, onDelete }: Props) {
  const [translatedText, setTranslatedText] = useState<string>('')
  const displayText = translatedText || message.bodyEncrypted
  const timeStr     = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const reactionMap = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className={`flex gap-2 mb-3 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-1">
          {message.sender.displayName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <span className="text-xs text-gray-500 mb-1 ml-1">{message.sender.displayName}</span>
        )}

        {/* Bubble */}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isOwn
            ? 'bg-primary-500 text-white rounded-tr-sm'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 rounded-tl-sm'
        }`}>
          <p className="whitespace-pre-wrap break-words">{displayText}</p>
          {translatedText && (
            <p className="text-[10px] mt-1 opacity-60 italic">AI translated</p>
          )}

          <div className={`flex items-center gap-2 mt-1 flex-wrap ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-[10px] ${isOwn ? 'text-primary-200' : 'text-gray-400'}`}>{timeStr}</span>
            {message.editedAt && (
              <span className={`text-[10px] ${isOwn ? 'text-primary-200' : 'text-gray-400'}`}>· edited</span>
            )}
            {message.selfDestructAt && <span className="text-[10px] text-orange-400">💣</span>}
            {/* Tone badge — loads lazily on hover */}
            {!isOwn && message.bodyEncrypted.length >= 20 && (
              <ToneBadge
                messageId={message.id}
                text={message.bodyEncrypted}
                accessToken={accessToken}
              />
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionMap).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(reactionMap).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                {emoji} <span className="text-gray-500 dark:text-gray-400">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover actions */}
        <div className={`flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Quick reactions */}
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => onReact(message.id, emoji)}
              className="text-sm hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}

          {/* Translate */}
          <TranslateButton
            messageId={message.id}
            accessToken={accessToken}
            onTranslated={setTranslatedText}
          />

          {/* Edit / delete (own messages only) */}
          {isOwn && onEdit && (
            <button onClick={() => onEdit(message)} className="text-xs text-gray-400 hover:text-gray-600">
              Edit
            </button>
          )}
          {isOwn && onDelete && (
            <button onClick={() => onDelete(message.id)} className="text-xs text-red-400 hover:text-red-600">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
