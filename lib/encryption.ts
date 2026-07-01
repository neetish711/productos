import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

/**
 * AUDIT S2-9: thrown when stored ciphertext cannot be decrypted (e.g. the
 * ENCRYPTION_SECRET changed). Callers should map this to an actionable
 * "re-enter your API key" message instead of a generic 500.
 */
export class DecryptionError extends Error {
  constructor(message = 'Unable to decrypt stored secret — the encryption key may have changed. Please re-enter your API key in Settings.') {
    super(message)
    this.name = 'DecryptionError'
  }
}

function deriveKey(secret: string): Buffer {
  // Derive a stable 32-byte key via SHA-256 so any secret length works.
  return createHash('sha256').update(secret, 'utf-8').digest()
}

/**
 * AUDIT S2-9: support key rotation. Encryption always uses the current secret;
 * decryption tries the current secret first, then ENCRYPTION_SECRET_PREVIOUS if
 * set. To rotate: move the old value to ENCRYPTION_SECRET_PREVIOUS, set the new
 * one as ENCRYPTION_SECRET. Existing ciphertext keeps decrypting until re-saved.
 */
function getDecryptionKeys(): Buffer[] {
  const current = process.env.ENCRYPTION_SECRET
  if (!current) throw new Error('ENCRYPTION_SECRET env var is not set')
  const keys = [deriveKey(current)]
  const previous = process.env.ENCRYPTION_SECRET_PREVIOUS
  if (previous) keys.push(deriveKey(previous))
  return keys
}

function getEncryptionKey(): Buffer {
  const current = process.env.ENCRYPTION_SECRET
  if (!current) throw new Error('ENCRYPTION_SECRET env var is not set')
  return deriveKey(current)
}

export function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const key = getEncryptionKey()
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
  const ivBuffer = Buffer.from(iv, 'hex')
  // Last 32 hex chars (16 bytes) are the auth tag
  const authTag = Buffer.from(ciphertext.slice(-32), 'hex')
  const encrypted = ciphertext.slice(0, -32)

  // AUDIT S2-9: try current then previous key; wrap GCM auth failures.
  for (const key of getDecryptionKeys()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, ivBuffer)
      decipher.setAuthTag(authTag)
      let decrypted = decipher.update(encrypted, 'hex', 'utf-8')
      decrypted += decipher.final('utf-8')
      return decrypted
    } catch {
      // try next key
    }
  }
  throw new DecryptionError()
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••'
  return key.slice(0, 7) + '••••' + key.slice(-4)
}
