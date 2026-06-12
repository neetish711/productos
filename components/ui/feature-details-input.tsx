'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Square, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoiceState = 'idle' | 'listening' | 'transcribing' | 'done' | 'error'

export interface FeatureDetailsInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  id?: string
}

// Augment window for webkit prefix
declare global {
  interface Window {
    SpeechRecognition?: any
    webkitSpeechRecognition?: any
  }
}

// ---------------------------------------------------------------------------
// Waveform animation
// ---------------------------------------------------------------------------

const BAR_HEIGHTS = [5, 9, 14, 10, 16, 8, 13, 7, 15, 10, 6, 12, 9, 14, 5]

function WaveformBars() {
  return (
    <>
      <style>{`
        @keyframes voice-bar {
          0%, 100% { transform: scaleY(0.25); opacity: 0.5; }
          50%       { transform: scaleY(1);    opacity: 1;   }
        }
      `}</style>
      <div className="flex items-center gap-[2px]">
        {BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="rounded-full bg-primary origin-center"
            style={{
              width: '2.5px',
              height: `${h}px`,
              animation: `voice-bar ${0.55 + (i % 4) * 0.1}s ease-in-out infinite`,
              animationDelay: `${i * 0.045}s`,
            }}
          />
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FeatureDetailsInput({
  value,
  onChange,
  placeholder = "Describe what needs to be built: the user problem, scope, key requirements, edge cases, constraints, and any implementation notes.",
  disabled,
  rows = 6,
  id,
}: FeatureDetailsInputProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [supported, setSupported] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef<any>(null)
  const pendingTranscriptRef = useRef<string>('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) setSupported(false)
  }, [])

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    setErrorMsg('')
    pendingTranscriptRef.current = ''

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onstart = () => setVoiceState('listening')

    recognition.onresult = (event: any) => {
      pendingTranscriptRef.current = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(' ')
        .trim()
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setErrorMsg('Microphone access denied. Check browser permissions.')
      } else if (event.error === 'no-speech') {
        setErrorMsg('No speech detected. Try again.')
      } else {
        setErrorMsg('Recording failed. Please try again.')
      }
      recognitionRef.current = null
      setVoiceState('error')
      setTimeout(() => setVoiceState('idle'), 4000)
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setVoiceState('transcribing')
      // Small delay to let the last result fire
      setTimeout(() => {
        const transcript = pendingTranscriptRef.current
        if (transcript) {
          onChange(value ? `${value}\n\n${transcript}` : transcript)
          setVoiceState('done')
          setTimeout(() => setVoiceState('idle'), 3000)
        } else {
          setErrorMsg('Nothing captured. Try speaking closer to the mic.')
          setVoiceState('error')
          setTimeout(() => setVoiceState('idle'), 4000)
        }
      }, 400)
    }

    try {
      recognition.start()
    } catch {
      setErrorMsg('Could not start recording.')
      setVoiceState('error')
      setTimeout(() => setVoiceState('idle'), 3000)
    }
  }, [value, onChange])

  const stopListening = useCallback(() => {
    // onend will fire and handle state transition
    stopRecognition()
  }, [stopRecognition])

  const discardAndReset = useCallback(() => {
    stopRecognition()
    setVoiceState('idle')
    setErrorMsg('')
  }, [stopRecognition])

  // Clean up on unmount
  useEffect(() => () => stopRecognition(), [stopRecognition])

  const isListening = voiceState === 'listening'
  const isTranscribing = voiceState === 'transcribing'
  const isActive = isListening || isTranscribing

  return (
    <div
      className={cn(
        'relative rounded-md border bg-background transition-all duration-200',
        isListening && 'ring-2 ring-primary border-primary shadow-sm shadow-primary/10',
        voiceState === 'done' && 'ring-2 ring-emerald-500/50 border-emerald-500',
        voiceState === 'error' && 'border-destructive',
        !isActive && voiceState !== 'done' && voiceState !== 'error'
          && 'focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent'
      )}
    >
      {/* Textarea — hidden while voice overlay is active */}
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isActive ? '' : placeholder}
        disabled={disabled || isActive}
        rows={rows}
        className={cn(
          'w-full resize-y bg-transparent px-3 pt-3 pb-14 text-sm outline-none rounded-md',
          'placeholder:text-muted-foreground/50 leading-relaxed',
          isActive && 'pointer-events-none select-none opacity-0'
        )}
      />

      {/* Listening overlay */}
      {isListening && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-md bg-background/95 pb-10">
          <WaveformBars />
          <p className="text-sm font-medium text-primary tracking-wide">
            Listening… speak your feature requirements
          </p>
          <p className="text-xs text-muted-foreground">
            Click <strong>Stop</strong> when you're done
          </p>
        </div>
      )}

      {/* Transcribing overlay */}
      {isTranscribing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-md bg-background/95 pb-10">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Converting speech to text…</p>
        </div>
      )}

      {/* Bottom bar — always visible */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 px-3 py-2 rounded-b-md border-t border-border/50 bg-muted/20">
        {/* Left: status text */}
        <div className="flex-1 min-w-0">
          {voiceState === 'error' && (
            <p className="text-xs text-destructive truncate">{errorMsg}</p>
          )}
          {voiceState === 'done' && (
            <p className="text-xs text-emerald-600 font-medium">
              ✓ Transcribed — review and edit above before generating
            </p>
          )}
          {isListening && (
            <p className="text-xs text-primary font-medium animate-pulse">● Recording</p>
          )}
          {isTranscribing && (
            <p className="text-xs text-muted-foreground">Processing…</p>
          )}
          {voiceState === 'idle' && !value && supported && (
            <p className="text-xs text-muted-foreground">
              Type or click <strong>Speak</strong> to dictate
            </p>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Clear text */}
          {value && (voiceState === 'idle' || voiceState === 'done') && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
              title="Clear text"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}

          {/* Discard while listening */}
          {isListening && (
            <button
              type="button"
              onClick={discardAndReset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
              title="Cancel recording"
            >
              <X className="h-3 w-3" />
              Discard
            </button>
          )}

          {/* Voice action button */}
          {supported && (
            isListening ? (
              <button
                type="button"
                onClick={stopListening}
                className="flex items-center gap-1.5 text-xs font-medium bg-red-500 text-white hover:bg-red-600 rounded-md px-2.5 py-1 transition-colors shadow-sm"
                title="Stop recording"
              >
                <Square className="h-3 w-3 fill-current" />
                Stop
              </button>
            ) : isTranscribing ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1">
                <div className="h-3 w-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
                Processing
              </div>
            ) : voiceState === 'error' ? (
              <button
                type="button"
                onClick={startListening}
                disabled={disabled}
                className="flex items-center gap-1.5 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 rounded-md px-2.5 py-1 transition-colors"
                title="Retry recording"
              >
                <MicOff className="h-3 w-3" />
                Retry
              </button>
            ) : (
              <button
                type="button"
                onClick={startListening}
                disabled={disabled}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium rounded-md px-2.5 py-1 transition-colors border',
                  voiceState === 'done'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                )}
                title={voiceState === 'done' ? 'Record again (appends to existing text)' : 'Record voice input'}
              >
                {voiceState === 'done' ? (
                  <><RotateCcw className="h-3 w-3" /> Record again</>
                ) : (
                  <><Mic className="h-3 w-3" /> Speak</>
                )}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
