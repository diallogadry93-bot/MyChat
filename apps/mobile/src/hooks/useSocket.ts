import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { AppState } from 'react-native'

const WS_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return

    const socket = io(WS_URL, {
      auth:            { token },
      transports:      ['websocket'],
      reconnection:    true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1000,
    })

    socketRef.current = socket

    socket.on('connect',    () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    // Handle app going to background / foreground
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && !socket.connected) socket.connect()
      if (state === 'background') socket.emit('ping')
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      sub.remove()
    }
  }, [token])

  return { socket: socketRef.current, connected }
}
