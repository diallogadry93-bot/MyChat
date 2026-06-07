'use client'
import { useAuth } from '@/lib/auth-context'
import { useSocket } from '@/hooks/useSocket'

export default function ChatPage() {
  const { user, accessToken, logout } = useAuth()
  const { connected } = useSocket({ token: accessToken })

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/auth/login'
    return null
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-sm">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{user.displayName}</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-xs text-gray-500">{connected ? 'Online' : 'Connecting…'}</span>
              </div>
            </div>
          </div>
          <button onClick={() => { void logout() }} className="text-xs text-gray-400 hover:text-gray-600 transition">
            Sign out
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Chats coming in Phase 2
        </div>
      </aside>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-5xl mb-4">💬</p>
          <p className="font-medium text-gray-600 dark:text-gray-300">Welcome, {user.displayName}</p>
          <p className="text-sm mt-1">Select a conversation to start chatting</p>
          <p className="text-xs mt-4 text-primary-400">WebSocket: {connected ? '✅ connected' : '⏳ connecting'}</p>
        </div>
      </main>
    </div>
  )
}
