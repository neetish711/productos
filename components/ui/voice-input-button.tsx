'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type VoiceState = 'idle' | 'listening' | 'processing' | 'error'

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
}

// Augment window for webkit prefix
declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

export function VoiceInputButton({ onTranscript, disabled, className }: VoiceInputButtonProps) {
  const [state, setState] = useState<VoiceState>('idle')
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) setSupported(false)
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onstart = () => setState('listening')

    recognition.onresult = (event: any) => {
      setState('processing')
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(' ')
        .trim()
      if (transcript) onTranscript(transcript)
    }

    recognition.onerror = () => {
      setState('error')
      recognitionRef.current = null
      setTimeout(() => setState('idle'), 2000)
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setState((prev) => (prev === 'processing' ? 'idle' : prev === 'error' ? prev : 'idle'))
    }

    setState('listening')
    recognition.start()
  }, [onTranscript])

  const handleClick = useCallback(() => {
    if (state === 'listening') {
      stop()
      setState('idle')
    } else if (state === 'idle') {
      start()
    }
  }, [state, start, stop])

  // Clean up on unmount
  useEffect(() => () => stop(), [stop])

  if (!supported) return null

  const title =
    state === 'idle'
      ? 'Click to dictate'
      : state === 'listening'
      ? 'Listening… click to stop'
      : state === 'processing'
      ? 'Processing…'
      : 'Speech error – try again'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-7 w-7 shrink-0 transition-colors',
        state === 'listening' && 'text-red-500 hover:text-red-600',
        state === 'error' && 'text-destructive',
        className
      )}
      onClick={handleClick}
      disabled={disabled || state === 'processing'}
      title={title}
      aria-label={title}
    >
      {state === 'processing' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === 'error' ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className={cn('h-4 w-4', state === 'listening' && 'animate-pulse')} />
      )}
    </Button>
  )
}
