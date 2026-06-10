import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useAuth }   from '../lib/auth'
import { useSocket } from '../hooks/useSocket'
import { api }       from '../lib/api'

interface Message {
  id: string; senderId: string; bodyEncrypted: string
  createdAt: string; selfDestructAt: string | null
  reactions: Array<{ emoji: string; userId: string }>
  sender: { id: string; displayName: string }
}

interface Props {
  chatId:   string
  chatName: string
  onBack:   () => void
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮']

export function ChatScreen({ chatId, chatName, onBack }: Props) {
  const { user, accessToken } = useAuth()
  const { socket, connected } = useSocket(accessToken)

  const [messages, setMessages] = useState<Message[]>([])
  const [text,     setText]     = useState('')
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)
  const [typing,   setTyping]   = useState<string[]>([])
  const flatListRef  = useRef<FlatList>(null)
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Load initial messages
  useEffect(() => {
    if (!accessToken) return
    api.messages.list(accessToken, chatId)
      .then(r => setMessages((r.messages as Message[]).reverse()))
      .catch(console.error)
      .finally(() => setLoading(false))

    socket?.emit('chat:join', chatId)
    return () => { socket?.emit('chat:leave', chatId) }
  }, [accessToken, chatId, socket])

  // Socket events
  useEffect(() => {
    if (!socket) return

    socket.on('message:new', (msg: unknown) => {
      const m = msg as Message
      setMessages(prev => prev.find(p => p.id === m.id) ? prev : [m, ...prev])
    })

    socket.on('message:reaction', ({ messageId, reactions }: { messageId: string; reactions: Array<{ emoji: string; userId: string }> }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m))
    })

    socket.on('typing:start', ({ userId }: { userId: string }) => {
      setTyping(p => p.includes(userId) ? p : [...p, userId])
      clearTimeout(typingTimers.current[userId])
      typingTimers.current[userId] = setTimeout(() => {
        setTyping(p => p.filter(id => id !== userId))
      }, 3000)
    })

    socket.on('typing:stop', ({ userId }: { userId: string }) => {
      setTyping(p => p.filter(id => id !== userId))
    })

    return () => {
      socket.off('message:new')
      socket.off('message:reaction')
      socket.off('typing:start')
      socket.off('typing:stop')
    }
  }, [socket])

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || !accessToken || sending) return
    setSending(true)
    setText('')
    try {
      await api.messages.send(accessToken, chatId, {
        bodyEncrypted: trimmed,
        iv: 'plaintext-phase2',
        type: 'text',
      })
    } catch (err) {
      console.error('Send failed:', err)
      setText(trimmed) // restore on failure
    } finally {
      setSending(false)
    }
  }, [text, accessToken, chatId, sending])

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    if (!accessToken) return
    await api.messages.react(accessToken, messageId, emoji).catch(console.error)
  }, [accessToken])

  const handleTyping = (val: string) => {
    setText(val)
    socket?.emit('typing:start', chatId)
    clearTimeout(typingTimers.current['self'])
    typingTimers.current['self'] = setTimeout(() => {
      socket?.emit('typing:stop', chatId)
    }, 2000)
  }

  const renderMessage = ({ item: msg }: { item: Message }) => {
    const isOwn = msg.senderId === user?.id
    const time  = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const reactionMap = msg.reactions.reduce<Record<string, number>>((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1
      return acc
    }, {})

    return (
      <View style={[styles.msgRow, isOwn && styles.msgRowOwn]}>
        {!isOwn && (
          <View style={styles.msgAvatar}>
            <Text style={styles.msgAvatarText}>{msg.sender.displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {!isOwn && <Text style={styles.senderName}>{msg.sender.displayName}</Text>}
          <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>{msg.bodyEncrypted}</Text>
          <View style={styles.msgMeta}>
            {msg.selfDestructAt && <Text style={styles.destructIcon}>💣 </Text>}
            <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>{time}</Text>
          </View>
          {/* Quick reactions */}
          <View style={styles.quickReactions}>
            {QUICK_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => { void handleReact(msg.id, emoji) }}
                style={styles.quickReactionBtn}
              >
                <Text style={styles.quickReactionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Reaction counts */}
          {Object.keys(reactionMap).length > 0 && (
            <View style={styles.reactions}>
              {Object.entries(reactionMap).map(([emoji, count]) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => { void handleReact(msg.id, emoji) }}
                  style={styles.reactionPill}
                >
                  <Text style={styles.reactionText}>{emoji} {count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{chatName}</Text>
          <Text style={styles.headerStatus}>
            {connected ? '🔒 Encrypted' : '⏳ Connecting…'}
          </Text>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A56DB" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messageList}
          ListFooterComponent={
            typing.length > 0 ? (
              <View style={styles.typingRow}>
                <Text style={styles.typingText}>Someone is typing…</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleTyping}
          placeholder="Message…"
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={4096}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => { void handleSend() }}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sendIcon}>▶</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#F9FAFB' },
  header:            { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, paddingTop: Platform.OS === 'ios' ? 52 : 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  backBtn:           { padding: 8 },
  backIcon:          { fontSize: 22, color: '#1A56DB', fontWeight: '600' },
  headerInfo:        { flex: 1 },
  headerName:        { fontWeight: '700', fontSize: 15, color: '#111827' },
  headerStatus:      { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  loadingContainer:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList:       { padding: 12, paddingBottom: 4 },
  msgRow:            { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', gap: 8 },
  msgRowOwn:         { flexDirection: 'row-reverse' },
  msgAvatar:         { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  msgAvatarText:     { color: '#1A56DB', fontWeight: '700', fontSize: 11 },
  bubble:            { maxWidth: '72%', borderRadius: 18, padding: 10, paddingHorizontal: 13 },
  bubbleOwn:         { backgroundColor: '#1A56DB', borderBottomRightRadius: 4 },
  bubbleOther:       { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#F3F4F6' },
  senderName:        { fontSize: 11, color: '#6B7280', marginBottom: 2, fontWeight: '600' },
  msgText:           { fontSize: 15, color: '#111827', lineHeight: 21 },
  msgTextOwn:        { color: '#fff' },
  msgMeta:           { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  destructIcon:      { fontSize: 10 },
  msgTime:           { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  msgTimeOwn:        { color: 'rgba(255,255,255,0.7)' },
  quickReactions:    { flexDirection: 'row', gap: 4, marginTop: 4, opacity: 0 }, // shown on long press in future
  quickReactionBtn:  { padding: 2 },
  quickReactionText: { fontSize: 14 },
  reactions:         { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reactionPill:      { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  reactionText:      { fontSize: 12, color: '#374151' },
  typingRow:         { paddingHorizontal: 16, paddingVertical: 6 },
  typingText:        { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  inputRow:          { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6', alignItems: 'flex-end', gap: 8 },
  input:             { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 22, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 15, maxHeight: 120, color: '#111827' },
  sendBtn:           { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A56DB', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:   { opacity: 0.4 },
  sendIcon:          { color: '#fff', fontSize: 16, marginLeft: 2 },
})
