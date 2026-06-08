'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth }          from '@/lib/auth-context'
import { useSocket }        from '@/hooks/useSocket'
import { api }              from '@/lib/api'
import { ChatSidebar }      from '@/components/chat/ChatSidebar'
import { MessageBubble }    from '@/components/chat/MessageBubble'
import { MessageInput }     from '@/components/chat/MessageInput'
import { TypingIndicator }  from '@/components/chat/TypingIndicator'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  id: string; senderId: string; type: string
  bodyEncrypted: string; editedAt: string | null; selfDestructAt: string | null
  createdAt: string; reactions: Array<{ emoji: string; userId: string }>
  attachments: Array<{ id: string; storageKey: string; mimeType: string; sizeBytes: number }>
  sender: { id: string; displayName: string; avatarUrl: string | null }
}
interface Chat {
  id: string; type: string; name: string | null
  lastMessage?: { bodyEncrypted: string; createdAt: string } | null
  members: Array<{ user: { id: string; displayName: string; avatarUrl: string | null; isOnline: boolean } }>
}

export default function ChatPage() {
  const { user, accessToken, logout } = useAuth()
  const { socket, connected }         = useSocket({ token: accessToken })

  const [chats, setChats]           = useState<Chat[]>([])
  const [activeChatId, setActive]   = useState<string | null>(null)
  const [messages, setMessages]     = useState<Message[]>([])
  const [typingUsers, setTyping]    = useState<string[]>([])
  const [loadingMsgs, setLoading]   = useState(false)
  const [editingMsg, setEditing]    = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Redirect if not authed
  useEffect(() => {
    if (!user && typeof window !== 'undefined') window.location.href = '/auth/login'
  }, [user])

  // Load chat list
  useEffect(() => {
    if (!accessToken) return
    api.chats.list(accessToken).then(r => setChats(r.chats)).catch(console.error)
  }, [accessToken])

  // Load messages when chat changes
  useEffect(() => {
    if (!activeChatId || !accessToken) return
    setLoading(true)
    api.messages.list(accessToken, activeChatId)
      .then(r => { setMessages(r.messages); setTyping([]) })
      .catch(console.error)
      .finally(() => setLoading(false))

    // Join socket room
    socket?.emit('chat:join', activeChatId)
    return () => { socket?.emit('chat:leave', activeChatId) }
  }, [activeChatId, accessToken, socket])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Socket events
  useEffect(() => {
    if (!socket) return

    socket.on('message:new', (msg: unknown) => {
      const m = msg as Message
      setMessages(prev => {
        if (prev.find(p => p.id === m.id)) return prev
        return [...prev, m]
      })
      setChats(prev => prev.map(c =>
        c.id === m.chatId ? { ...c, lastMessage: { bodyEncrypted: m.bodyEncrypted, createdAt: m.createdAt } } : c
      ) as Chat[])
    })

    socket.on('message:edited', (updated: unknown) => {
      const m = updated as Message
      setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, ...m } : msg))
    })

    socket.on('message:deleted', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    })

    socket.on('message:reaction', ({ messageId, reactions }: { messageId: string; reactions: Array<{ emoji: string; userId: string }> }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m))
    })

    socket.on('typing:start', ({ userId }: { userId: string; chatId: string }) => {
      const name = chats.flatMap(c => c.members).find(m => m.user.id === userId)?.user.displayName
      if (!name) return
      setTyping(prev => prev.includes(name) ? prev : [...prev, name])
      clearTimeout(typingTimers.current[userId])
      typingTimers.current[userId] = setTimeout(() => {
        setTyping(prev => prev.filter(n => n !== name))
      }, 3000)
    })

    socket.on('typing:stop', ({ userId }: { userId: string; chatId: string }) => {
      const name = chats.flatMap(c => c.members).find(m => m.user.id === userId)?.user.displayName
      if (name) setTyping(prev => prev.filter(n => n !== name))
    })

    return () => {
      socket.off('message:new')
      socket.off('message:edited')
      socket.off('message:deleted')
      socket.off('message:reaction')
      socket.off('typing:start')
      socket.off('typing:stop')
    }
  }, [socket, chats])

  // Send message
  const handleSend = useCallback(async (text: string, selfDestructSeconds?: number) => {
    if (!activeChatId || !accessToken || !user) return
    try {
      // In Phase 2 MVP: send text as bodyEncrypted (full E2E added with client lib in Phase 3)
      await api.messages.send(accessToken, activeChatId, {
        bodyEncrypted: text,
        iv: 'plaintext-phase2',
        type: 'text',
        ...(selfDestructSeconds ? { selfDestructSeconds } : {}),
      })
    } catch (err) { console.error('Send failed:', err) }
  }, [activeChatId, accessToken, user])

  // React to message
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!accessToken) return
    try { await api.messages.react(accessToken, messageId, emoji) }
    catch (err) { console.error('React failed:', err) }
  }, [accessToken])

  // Edit message
  const handleEdit = useCallback(async (messageId: string, newText: string) => {
    if (!accessToken) return
    try {
      await api.messages.edit(accessToken, messageId, { bodyEncrypted: newText, iv: 'plaintext-phase2' })
      setEditing(null)
    } catch (err) { console.error('Edit failed:', err) }
  }, [accessToken])

  // Delete message
  const handleDelete = useCallback(async (messageId: string) => {
    if (!accessToken || !confirm('Delete this message?')) return
    try { await api.messages.delete(accessToken, messageId) }
    catch (err) { console.error('Delete failed:', err) }
  }, [accessToken])

  const activeChat = chats.find(c => c.id === activeChatId)

  if (!user) return null

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">

      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* User header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-sm">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{user.displayName}</p>
              <p className="text-xs text-gray-400">{connected ? 'Online' : 'Connecting…'}</p>
            </div>
          </div>
          <button onClick={() => { void logout() }} className="text-xs text-gray-400 hover:text-red-500 transition">
            Sign out
          </button>
        </div>

        <ChatSidebar
          chats={chats}
          activeChatId={activeChatId}
          currentUserId={user.id}
          onSelectChat={setActive}
          onNewChat={() => alert('New chat UI coming soon!')}
        />
      </aside>

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                {(activeChat.name ?? activeChat.members.find(m => m.user.id !== user.id)?.user.displayName ?? '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">
                  {activeChat.name ?? activeChat.members.find(m => m.user.id !== user.id)?.user.displayName ?? 'Chat'}
                </p>
                <p className="text-xs text-gray-400">{activeChat.members.length} members · 🔒 End-to-end encrypted</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <p className="text-4xl mb-3">🔒</p>
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Messages are end-to-end encrypted</p>
                </div>
              ) : (
                <>
                  {messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.senderId === user.id}
                      onReact={handleReact}
                      onEdit={msg.senderId === user.id ? setEditing : undefined}
                      onDelete={msg.senderId === user.id ? handleDelete : undefined}
                    />
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            <TypingIndicator names={typingUsers} />

            {/* Edit mode banner */}
            {editingMsg && (
              <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 flex items-center justify-between">
                <span className="text-xs text-yellow-700 dark:text-yellow-400">✏️ Editing message</span>
                <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}

            <MessageInput
              onSend={editingMsg
                ? (text) => { void handleEdit(editingMsg.id, text) }
                : handleSend
              }
              onTypingStart={() => activeChatId && socket?.emit('typing:start', activeChatId)}
              onTypingStop={() => activeChatId && socket?.emit('typing:stop', activeChatId)}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <p className="text-6xl mb-4">💬</p>
            <p className="font-medium text-gray-600 dark:text-gray-300">Select a conversation</p>
            <p className="text-sm mt-1">or start a new one</p>
          </div>
        )}
      </main>
    </div>
  )
}
