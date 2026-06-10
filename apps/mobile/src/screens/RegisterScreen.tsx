import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { useAuth } from '../lib/auth'

export function RegisterScreen({ onNavigateLogin }: { onNavigateLogin: () => void }) {
  const { register } = useAuth()
  const [form,    setForm]    = useState({ displayName: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!form.email || !form.password || !form.displayName) {
      Alert.alert('Missing fields', 'Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      await register(form.email.toLowerCase().trim(), form.password, form.displayName.trim())
    } catch (err) {
      Alert.alert('Registration failed', err instanceof Error ? err.message : 'Please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>MyChat</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          {(['displayName', 'email', 'password'] as const).map(field => (
            <TextInput
              key={field}
              style={styles.input}
              placeholder={field === 'displayName' ? 'Display name' : field === 'email' ? 'Email' : 'Password (min 8 chars)'}
              placeholderTextColor="#9CA3AF"
              autoCapitalize={field === 'displayName' ? 'words' : 'none'}
              keyboardType={field === 'email' ? 'email-address' : 'default'}
              secureTextEntry={field === 'password'}
              value={form[field]}
              onChangeText={v => setForm(f => ({ ...f, [field]: v }))}
            />
          ))}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => { void handleRegister() }}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Create account</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onNavigateLogin} style={styles.link}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Sign in</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F9FAFB' },
  scroll:         { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card:           { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  logo:           { fontSize: 32, fontWeight: '700', color: '#1A56DB', textAlign: 'center', marginBottom: 6 },
  subtitle:       { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 28 },
  input:          { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 12, backgroundColor: '#F9FAFB' },
  button:         { backgroundColor: '#1A56DB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText:     { color: '#fff', fontSize: 15, fontWeight: '600' },
  link:           { marginTop: 20, alignItems: 'center' },
  linkText:       { fontSize: 14, color: '#6B7280' },
  linkHighlight:  { color: '#1A56DB', fontWeight: '600' },
})
