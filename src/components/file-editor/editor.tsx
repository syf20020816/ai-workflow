import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

const languageMap: Record<string, any> = {
  json,
  markdown,
}

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: 'json' | 'markdown'
  readOnly?: boolean
  maxHeight?: number
}

export const CodeEditor = ({ value, onChange, language, readOnly, maxHeight }: CodeEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    // 销毁旧 editor
    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    const extensions = [
      basicSetup,
      oneDark,
      EditorView.theme({
        '&': { height: '100%', backgroundColor: '#141414' },
        '.cm-scroller': { overflow: 'auto' },
        '& .cm-gutters': { backgroundColor: '#141414' },
        '& .cm-gutters .cm-gutter': { backgroundColor: '#141414' },
        '.cm-content': { backgroundColor: '#141414', caretColor: '#fff' },
        '.cm-activeLine': { backgroundColor: '#2a2a2a' },
        '.cm-activeLineGutter': { backgroundColor: '#2a2a2a' },
      }),
    ]

    if (onChangeRef.current) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
        }),
      )
    }

    if (readOnly) {
      extensions.push(EditorView.editable.of(false))
    }

    if (language && languageMap[language]) {
      extensions.push(languageMap[language]())
    }

    const state = EditorState.create({
      doc: value,
      extensions: extensions.flat(),
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [language, readOnly])

  // 外部 value 变化时同步到 editor
  useEffect(() => {
    if (viewRef.current) {
      const currentDoc = viewRef.current.state.doc.toString()
      if (currentDoc !== value) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
        })
      }
    }
  }, [value])

  return <div ref={containerRef} style={maxHeight ? { maxHeight, overflow: 'hidden' } : { height: '100%' }} />
}
