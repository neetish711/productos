import { describe, it, expect } from 'vitest'
import { isGoogleChatWebhook } from '@/lib/integrations/google-chat'

// AUDIT S4-ci: guards the S3-5 webhook validation.
describe('isGoogleChatWebhook', () => {
  it('accepts a real Google Chat webhook', () => {
    expect(isGoogleChatWebhook('https://chat.googleapis.com/v1/spaces/AAAA/messages?key=k&token=t')).toBe(true)
  })
  it('rejects non-Google hosts', () => {
    expect(isGoogleChatWebhook('https://evil.example.com/v1/spaces/x/messages')).toBe(false)
  })
  it('rejects http', () => {
    expect(isGoogleChatWebhook('http://chat.googleapis.com/v1/spaces/x/messages')).toBe(false)
  })
  it('rejects garbage', () => {
    expect(isGoogleChatWebhook('not a url')).toBe(false)
  })
})
