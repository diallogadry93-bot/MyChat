import { useEffect, useState } from 'react'
import { View, ActivityIndicator, StatusBar } from 'react-native'

import { AuthContext, useAuthState } from './src/lib/auth'
import { LoginScreen }     from './src/screens/LoginScreen'
import { RegisterScreen }  from './src/screens/RegisterScreen'
import { ChatListScreen }  from './src/screens/ChatListScreen'
import { ChatScreen }      from './src/screens/ChatScreen'
import { registerForPushNotifications } from './src/lib/notifications'

type Screen = 'login' | 'register' | 'chatList' | 'chat'

export default function App() {
  const auth = useAuthState()
  const [screen, setScreen]     = useState<Screen>('login')
  const [activeChat, setActiveChat] = useState<{ id: string; name: string } | null>(null)

  // Register push notifications after login
  useEffect(() => {
    if (auth.user) {
      void registerForPushNotifications()
      setScreen('chatList')
    } else if (!auth.isLoading) {
      setScreen('login')
    }
  }, [auth.user, auth.isLoading])

  if (auth.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#1A56DB" />
      </View>
    )
  }

  return (
    <AuthContext.Provider value={auth}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {screen === 'login' && (
        <LoginScreen onNavigateRegister={() => setScreen('register')} />
      )}
      {screen === 'register' && (
        <RegisterScreen onNavigateLogin={() => setScreen('login')} />
      )}
      {screen === 'chatList' && (
        <ChatListScreen
          onSelectChat={(id, name) => {
            setActiveChat({ id, name })
            setScreen('chat')
          }}
        />
      )}
      {screen === 'chat' && activeChat && (
        <ChatScreen
          chatId={activeChat.id}
          chatName={activeChat.name}
          onBack={() => setScreen('chatList')}
        />
      )}
    </AuthContext.Provider>
  )
}
