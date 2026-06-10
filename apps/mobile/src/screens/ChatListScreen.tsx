import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

interface Chat {
  id: string; type: string; name: string | null
  lastMessage?: { bodyEncrypted: string; createdAt: string } | null
  members: Array<{ user: { id: string; displayName: string; isOnline: boolean } }>
}

interface Props {
  onSelectChat: (chatId: string, chatName: string) => void
}

export function ChatListScreen({ onSelectChat }: Props) {
  const { user, accessToken, logout } = useAuth()
  const [chats,      setChats]      = useState<Chat[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadChats = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await api.chats.list(accessToken)
      setChats(res.chats as Chat[])
    } catch (err) {
      console.error('Failed to load chats:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [accessToken])

  useEffect(() => { void loadChats() }, [loadChats])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{user?.displayName}</Text>
            <Text style={styles.userStatus}>Online</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => { void logout() }}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Messages</Text>

      <FlatList
        data={chats}
        keyExtractor={c => c.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void loadChats() }}
            tintColor="#1A56DB"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>Start a new conversation</Text>
          </View>
        }
        renderItem={({ item: chat }) => {
          const other = chat.type === 'direct'
            ? chat.members.find(m => m.user.id !== user?.id)
            : null
          const name    = chat.name ?? other?.user.displayName ?? 'Chat'
          const isOnline = other?.user.isOnline ?? false

          return (
            <TouchableOpacity
              style={styles.chatRow}
              onPress={() => onSelectChat(chat.id, name)}
              activeOpacity={0.7}
            >
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                {isOnline && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.chatInfo}>
                <Text style={styles.chatName} numberOfLines={1}>{name}</Text>
                {chat.lastMessage && (
                  <Text style={styles.chatPreview} numberOfLines={1}>🔒 Encrypted message</Text>
                )}
              </View>
              {chat.lastMessage && (
                <Text style={styles.chatTime}>
                  {new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F9FAFB' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:         { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A56DB', alignItems: 'center', justifyContent: 'center' },
  avatarText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  userName:       { fontWeight: '600', fontSize: 14, color: '#111827' },
  userStatus:     { fontSize: 11, color: '#22C55E' },
  logoutText:     { fontSize: 13, color: '#9CA3AF' },
  sectionTitle:   { fontSize: 20, fontWeight: '700', color: '#111827', padding: 16, paddingBottom: 8 },
  chatRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB', gap: 12 },
  chatAvatar:     { width: 46, height: 46, borderRadius: 23, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  chatAvatarText: { color: '#1A56DB', fontWeight: '700', fontSize: 17 },
  onlineDot:      { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff' },
  chatInfo:       { flex: 1 },
  chatName:       { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  chatPreview:    { fontSize: 13, color: '#9CA3AF' },
  chatTime:       { fontSize: 11, color: '#9CA3AF' },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptySubtext:   { fontSize: 13, color: '#9CA3AF' },
})
