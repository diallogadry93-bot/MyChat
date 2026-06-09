'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth }         from '@/lib/auth-context'
import { useSocket }       from '@/hooks/useSocket'
import { useCall }         from '@/hooks/useCall'
import { api }             from '@/lib/api'
import { ChatSidebar }     from '@/components/chat/ChatSidebar'
import { MessageBubble }   from '@/components/chat/MessageBubble'
import { MessageInput }    from '@/components/chat/MessageInput'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { CallView }        from '@/components/call/CallView'
import { SmartReplies }    from '@/components/ai/SmartReplies'
import { ChatSummary }     from '@/components/ai/ChatSummary'

interface Message {
  id: string; senderId: string; type: string; bodyEncrypted: string
  editedAt: string | null; selfDestructAt: string | null; createdAt: string
  reactions: Array<{ emoji: string; userId: string }>
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
  const [inputText, setInputText]   = useState('')
  const [unreadCount, setUnread]    = useState(0)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const lastMessageAt = messages[messages.length - 1]?.createdAt ?? null

  const {
    callState, callId, callType, participants, localStream,
    audioMuted, videoOff, screenSharing,
    startCall, answerCall, endCall, toggleAudio, toggleVideo, toggleScreenShare,
  } = useCall({ socket, currentUserId: user?.id ?? '' })

  useEffect(() => {
    if (!user && typeof window !== 'undefined') window.location.href = '/auth/login'
  }, [user])

  useEffect(() => {
    if (!accessToken) return
    api.chats.list(accessToken).then(r => setChats(r.chats as Chat[])).catch(console.error)
  }, [accessToken])

  useEffect(() => {
    if (!activeChatId || !accessToken) return
    setLoading(true)
    setUnread(0)
    api.messages.list(accessToken, activeChatId)
      .then(r => { setMessages(r.messages as Message[]); setTyping([]) })
      .catch(console.error)
      .finally(() => setLoading(false))
    socket?.emit('chat:join', activeChatId)
    return () => { socket?.emit('chat:leave', activeChatId) }
  }, [activeChatId, accessToken, socket])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!socket) return
    socket.on('message:new', (msg: unknown) => {
      const m = msg as Message & { chatId?: string }
      setMessages(prev => prev.find(p => p.id === m.id) ? prev : [...prev, m])
      setUnread(n => n + 1)
      setChats(prev => prev.map(c =>
        c.id === (m as unknown as { chatId: string }).chatId
          ? { ...c, lastMessage: { bodyEncrypted: m.bodyEncrypted, createdAt: m.createdAt } } : c
      ))
    })
    socket.on('message:edited',   (u: unknown) => { const m = u as Message; setMessages(p => p.map(x => x.id === m.id ? { ...x, ...m } : x)) })
    socket.on('message:deleted',  ({ messageId }: { messageId: string }) => setMessages(p => p.filter(m => m.id !== messageId)))
    socket.on('message:reaction', ({ messageId, reactions }: { messageId: string; reactions: Array<{ emoji: string; userId: string }> }) =>
      setMessages(p => p.map(m => m.id === messageId ? { ...m, reactions } : m))
    )
    socket.on('typing:start', ({ userId }: { userId: string }) => {
      const name = chats.flatMap(c => c.members).find(m => m.user.id === userId)?.user.displayName
      if (!name) return
      setTyping(p => p.includes(name) ? p : [...p, name])
      clearTimeout(typingTimers.current[userId])
      typingTimers.current[userId] = setTimeout(() => setTyping(p => p.filter(n => n !== name)), 3000)
    })
    socket.on('typing:stop', ({ userId }: { userId: string }) => {
      const name = chats.flatMap(c => c.members).find(m => m.user.id === userId)?.user.displayName
      if (name) setTyping(p => p.filter(n => n !== name))
    })
    return () => {
      ['message:new','message:edited','message:deleted','message:reaction','typing:start','typing:stop']
        .forEach(e => socket.off(e))
    }
  }, [socket, chats])

  const handleSend = useCallback(async (text: string, selfDestructSeconds?: number) => {
    if (!activeChatId || !accessToken) return
    await api.messages.send(accessToken, activeChatId, {
      bodyEncrypted: text, iv: 'plaintext-phase2', type: 'text',
      ...(selfDestructSeconds ? { selfDestructSeconds } : {}),
    }).catch(console.error)
  }, [activeChatId, accessToken])

  const handleReact  = useCallback(async (msgId: string, emoji: string) => {
    if (!accessToken) return
    await api.messages.react(accessToken, msgId, emoji).catch(console.error)
  }, [accessToken])

  const handleEdit   = useCallback(async (msgId: string, text: string) => {
    if (!accessToken) return
    await api.messages.edit(accessToken, msgId, { bodyEncrypted: text, iv: 'plaintext-phase2' }).catch(console.error)
    setEditing(null)
  }, [accessToken])

  const handleDelete = useCallback(async (msgId: string) => {
    if (!accessToken || !confirm('Delete this message?')) return
    await api.messages.delete(accessToken, msgId).catch(console.error)
  }, [accessToken])

  const activeChat = chats.find(c => c.id === activeChatId)
  const chatName   = activeChat?.name ?? activeChat?.members.find(m => m.user.id !== user?.id)?.user.displayName ?? 'Chat'

  if (!user) return null

  return (
    <>
      {callState !== 'idle' && (
        <CallView
          callState={callState} callType={callType} callId={callId}
          participants={participants} localStream={localStream}
          audioMuted={audioMuted} videoOff={videoOff} screenSharing={screenSharing}
          currentUser={{ id: user.id, displayName: user.displayName }}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onScreenShare={() => { void toggleScreenShare() }}
          onEndCall={() => { void endCall(accessToken ?? undefined) }}
          onAnswer={() => { void answerCall(callId ?? '', callType) }}
          onDecline={() => { void endCall() }}
        />
      )}

      <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
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
            chats={chats} activeChatId={activeChatId} currentUserId={user.id}
            onSelectChat={(id) => { setActive(id); setUnread(0) }}
            onNewChat={() => alert('New chat — coming soon!')}
          />
        </aside>

        {/* Main panel */}
        <main className="flex-1 flex flex-col min-w-0">
          {activeChat ? (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                    {chatName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{chatName}</p>
                    <p className="text-xs text-gray-400">{activeChat.members.length} members · 🔒 Encrypted · ✨ AI</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { void startCall(activeChatId!, 'voice', accessToken!) }}
                    disabled={callState !== 'idle'}
                    className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition disabled:opacity-40"
                    title="Voice call"
                  >📞</button>
                  <button
                    onClick={() => { void startCall(activeChatId!, 'video', accessToken!) }}
                    disabled={callState !== 'idle'}
                    className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition disabled:opacity-40"
                    title="Video call"
                  >📹</button>
                </div>
              </div>

              {/* AI summary banner — shows when 10+ unread */}
              {unreadCount >= 10 && activeChatId && accessToken && (
                <ChatSummary
                  chatId={activeChatId}
                  accessToken={accessToken}
                  unreadCount={unreadCount}
                />
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <p className="text-4xl mb-3">🔒</p>
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs mt-1">End-to-end encrypted · AI-powered</p>
                  </div>
                ) : (
                  <>
                    {messages.map(msg => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOwn={msg.senderId === user.id}
                        accessToken={accessToken ?? ''}
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

              {editingMsg && (
                <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 flex items-center justify-between">
                  <span className="text-xs text-yellow-700 dark:text-yellow-400">✏️ Editing message</span>
                  <button onClick={() => setEditing(null)} className="text-xs text-gray-500">Cancel</button>
                </div>
              )}

              {/* Smart replies — above input */}
              {activeChatId && accessToken && !editingMsg && (
                <SmartReplies
                  chatId={activeChatId}
                  accessToken={accessToken}
                  lastMessageAt={lastMessageAt}
                  onSelect={(text) => setInputText(text)}
                />
              )}

              <MessageInput
                key={inputText} // reset when smart reply selected
                onSend={editingMsg ? (t) => { void handleEdit(editingMsg.id, t) } : handleSend}
                onTypingStart={() => activeChatId && socket?.emit('typing:start', activeChatId)}
                onTypingStop={()  => activeChatId && socket?.emit('typing:stop',  activeChatId)}
                initialText={inputText}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <p className="text-6xl mb-4">💬</p>
              <p className="font-medium text-gray-600 dark:text-gray-300">Select a conversation</p>
              <p className="text-sm mt-1">AI summaries · Smart replies · Auto-translate</p>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
