'use client'

interface Chat {
  id: string
  type: string
  name: string | null
  lastMessage?: { bodyEncrypted: string; createdAt: string } | null
  members: Array<{ user: { id: string; displayName: string; avatarUrl: string | null; isOnline: boolean } }>
}

interface Props {
  chats: Chat[]
  activeChatId: string | null
  currentUserId: string
  onSelectChat: (chatId: string) => void
  onNewChat: () => void
}

export function ChatSidebar({ chats, activeChatId, currentUserId, onSelectChat, onNewChat }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">Messages</h2>
        <button
          onClick={onNewChat}
          className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center hover:bg-primary-100 transition"
          title="New chat"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <input
          type="text"
          placeholder="Search chats…"
          className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-8 text-center">
            <p className="text-3xl mb-3">💬</p>
            <p>No chats yet</p>
            <p className="text-xs mt-1">Start a new conversation</p>
          </div>
        )}
        {chats.map(chat => {
          const otherMember = chat.type === 'direct'
            ? chat.members.find(m => m.user.id !== currentUserId)
            : null
          const name    = chat.name ?? otherMember?.user.displayName ?? 'Unknown'
          const initial = name.charAt(0).toUpperCase()
          const isOnline = otherMember?.user.isOnline ?? false
          const isActive = chat.id === activeChatId

          return (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left ${
                isActive ? 'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-primary-500' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
                  {initial}
                </div>
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{name}</p>
                  {chat.lastMessage && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                      {new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {chat.lastMessage && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    🔒 Encrypted message
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
