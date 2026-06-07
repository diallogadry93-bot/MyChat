'use client'
import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3001'

interface UseSocketOptions {
  token: string | null
  onConnect?: () => void
  onDisconnect?: () => void
}

export function useSocket({ token, onConnect, onDisconnect }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      onConnect?.()
    })

    socket.on('disconnect', () => {
      setConnected(false)
      onDisconnect?.()
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, onConnect, onDisconnect])

  return { socket: socketRef.current, connected }
}
