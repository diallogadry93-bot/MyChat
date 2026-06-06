export type UserRole = 'admin' | 'member'
export type Platform = 'ios' | 'android' | 'web' | 'desktop'

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UserProfile extends User {
  isOnline: boolean
  lastSeen: Date | null
}
