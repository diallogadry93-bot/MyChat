'use client'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'

interface PrivacySettings {
  ghostMode:    { enabled: boolean; allowedIds: string[] }
  readReceipts: { enabled: boolean }
  retention:    Record<string, number>
}

export default function SettingsPage() {
  const { user, accessToken, logout } = useAuth()
  const [settings, setSettings] = useState<PrivacySettings | null>(null)
  const [saving,   setSaving]   = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    fetch('/api/privacy/settings', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json() as Promise<PrivacySettings>)
      .then(setSettings)
      .catch(console.error)
  }, [accessToken])

  const updateGhostMode = useCallback(async (enabled: boolean) => {
    if (!accessToken) return
    setSaving('ghost')
    await fetch('/api/privacy/ghost-mode', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ enabled, allowedIds: settings?.ghostMode.allowedIds ?? [] }),
    })
    setSettings(s => s ? { ...s, ghostMode: { ...s.ghostMode, enabled } } : s)
    setSaving(null)
  }, [accessToken, settings])

  const updateReadReceipts = useCallback(async (enabled: boolean) => {
    if (!accessToken) return
    setSaving('receipts')
    await fetch('/api/privacy/read-receipts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ enabled }),
    })
    setSettings(s => s ? { ...s, readReceipts: { enabled } } : s)
    setSaving(null)
  }, [accessToken])

  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/auth/login'
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
          </div>
          <a href="/chat" className="text-sm text-primary-500 hover:underline">← Back to chats</a>
        </div>

        {/* Profile */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{user.displayName}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 mb-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Privacy</h2>
          <p className="text-xs text-gray-400 mb-5">Control who can see your information</p>

          {/* Ghost mode */}
          <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">👻 Ghost mode</p>
              <p className="text-xs text-gray-400 mt-0.5">Appear offline to everyone except allowed contacts</p>
            </div>
            <button
              onClick={() => { void updateGhostMode(!settings?.ghostMode.enabled) }}
              disabled={saving === 'ghost'}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings?.ghostMode.enabled ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                settings?.ghostMode.enabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Read receipts */}
          <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">✓✓ Read receipts</p>
              <p className="text-xs text-gray-400 mt-0.5">Let others know when you've read their messages</p>
            </div>
            <button
              onClick={() => { void updateReadReceipts(!settings?.readReceipts.enabled) }}
              disabled={saving === 'receipts'}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings?.readReceipts.enabled !== false ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                settings?.readReceipts.enabled !== false ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Screenshot detection note */}
          <div className="flex items-start gap-3 py-4">
            <span className="text-lg">📸</span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Screenshot detection</p>
              <p className="text-xs text-gray-400 mt-0.5">
                The mobile app notifies you when someone screenshots a conversation.
                Active on iOS and Android.
              </p>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-red-500 mb-4">Account</h2>
          <button
            onClick={() => { void logout() }}
            className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition"
          >
            Sign out of all devices
          </button>
        </section>
      </div>
    </div>
  )
}
