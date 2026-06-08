import { createCipheriv, createDecipheriv, randomBytes, createHash, hkdfSync } from 'crypto'

/**
 * MyChat E2E Encryption
 *
 * Implements a simplified Signal-Protocol-inspired scheme using
 * Node.js built-in crypto (no external deps needed for the server).
 *
 * Flow:
 *  1. Each user generates an identity key pair (X25519) on their device
 *  2. Server stores public keys + pre-keys per device
 *  3. Sender fetches recipient pre-key bundle, derives shared secret via X3DH
 *  4. Messages encrypted with AES-256-GCM using Double-Ratchet-derived keys
 *  5. Server only stores ciphertext + IV — never plaintext
 *
 * For Phase 2 we implement server-side helpers.
 * Full client-side Signal Protocol via @signalapp/libsignal-client added in Phase 2 mobile.
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32  // 256 bits
const IV_LENGTH  = 12  // 96 bits (GCM standard)
const TAG_LENGTH = 16  // 128 bits

export interface EncryptedPayload {
  ciphertext: string  // base64
  iv: string          // base64
  tag: string         // base64
}

/**
 * Encrypt plaintext with AES-256-GCM
 * Used server-side for system messages only.
 * User messages are encrypted client-side before reaching the server.
 */
export function encryptMessage(plaintext: string, keyHex: string): EncryptedPayload {
  const key = Buffer.from(keyHex, 'hex')
  const iv  = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: encrypted.toString('base64'),
    iv:         iv.toString('base64'),
    tag:        tag.toString('base64'),
  }
}

/**
 * Decrypt AES-256-GCM ciphertext
 */
export function decryptMessage(payload: EncryptedPayload, keyHex: string): string {
  const key        = Buffer.from(keyHex, 'hex')
  const iv         = Buffer.from(payload.iv, 'base64')
  const tag        = Buffer.from(payload.tag, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Derive a message key from a shared secret using HKDF-SHA256
 * Used during X3DH key exchange
 */
export function deriveMessageKey(sharedSecret: Buffer, salt: string): string {
  const derived = hkdfSync('sha256', sharedSecret, salt, 'MyChat-v1-message-key', KEY_LENGTH)
  return Buffer.from(derived).toString('hex')
}

/**
 * Generate a random 256-bit key (for system messages / testing)
 */
export function generateKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Hash a value with SHA-256 (for key fingerprints / verification)
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
