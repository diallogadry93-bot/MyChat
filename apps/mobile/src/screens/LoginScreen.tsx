import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useAuth } from '../lib/auth'

export function LoginScreen({ onNavigateRegister }: { onNavigateRegister: () => void }) {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    try {
      await login(email.toLowerCase().trim(), password)
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>MyChat</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => { void handleLogin() }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Sign in</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={onNavigateRegister} style={styles.link}>
          <Text style={styles.linkText}>No account? <Text style={styles.linkHighlight}>Create one</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', padding: 24 },
  card:            { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  logo:            { fontSize: 32, fontWeight: '700', color: '#1A56DB', textAlign: 'center', marginBottom: 6 },
  subtitle:        { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 28 },
  input:           { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 12, backgroundColor: '#F9FAFB' },
  button:          { backgroundColor: '#1A56DB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonDisabled:  { opacity: 0.6 },
  buttonText:      { color: '#fff', fontSize: 15, fontWeight: '600' },
  link:            { marginTop: 20, alignItems: 'center' },
  linkText:        { fontSize: 14, color: '#6B7280' },
  linkHighlight:   { color: '#1A56DB', fontWeight: '600' },
})
