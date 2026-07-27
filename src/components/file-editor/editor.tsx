import { useEffect, useRef, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { Copy } from 'lucide-react'
import { message } from 'antd'
import styles from './editor.module.scss'

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

export const CodeEditor = ({
  value,
  onChange,
  language,
  readOnly,
  maxHeight,
}: CodeEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [copied, setCopied] = useState(false)

  // 注入选中高亮样式（兜底，确保覆盖 oneDark）
  useEffect(() => {
    const id = 'cm-selection-style'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = `
        .cm-editor .cm-selectionLayer .cm-selectionBackground,
        .cm-editor.cm-focused .cm-selectionLayer .cm-selectionBackground,
        .cm-editor .cm-content ::selection {
          background-color: #264f78 !important;
        }
      `
      document.head.appendChild(s)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      message.error('复制失败')
    }
  }

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
        '& .cm-selectionLayer .cm-selectionBackground': {
          backgroundColor: '#264f78',
        },
        '&.cm-focused .cm-selectionLayer .cm-selectionBackground': {
          backgroundColor: '#264f78',
        },
        '.cm-content ::selection': {
          backgroundColor: '#264f78',
        },
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

  return (
    <div
      className={styles.wrapper}
      style={maxHeight ? { maxHeight, overflow: 'hidden' } : { height: '100%' }}
    >
      <div ref={containerRef} style={{ height: '100%' }} />
      <button className={styles.copyBtn} onClick={handleCopy} aria-label="复制">
        <Copy size={14} />
        {copied && <span className={styles.copyTip}>已复制</span>}
      </button>
    </div>
  )
}
