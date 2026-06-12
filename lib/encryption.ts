import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) throw new Error('ENCRYPTION_SECRET env var is not set')
  // Derive a stable 32-byte key via SHA-256 so any secret length works
  return createHash('sha256').update(secret, 'utf-8').digest()
}

export function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf-8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // Store ciphertext + auth tag together
  return {
    ciphertext: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex'),
  }
}

export function decrypt(ciphertext: string, iv: string): string {
  const key = getKey()
  const ivBuffer = Buffer.from(iv, 'hex')

  // Last 32 hex chars (16 bytes) are the auth tag
  const authTag = Buffer.from(ciphertext.slice(-32), 'hex')
  const encrypted = ciphertext.slice(0, -32)

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf-8')
  decrypted += decipher.final('utf-8')
  return decrypted
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••'
  return key.slice(0, 7) + '••••' + key.slice(-4)
}
