'use client'

import { useEffect, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
// @ts-ignore
import { useTheme } from 'next-themes'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  specId: string
}

export default function MarkdownEditor({ value, onChange, specId }: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[
          markdown(),
          EditorView.lineWrapping,
        ]}
        theme={isDark ? oneDark : 'light'}
        className="flex-1 overflow-auto text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
        style={{ height: '100%' }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
        }}
      />
    </div>
  )
}
