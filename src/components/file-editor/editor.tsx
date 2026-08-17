import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { Copy } from 'lucide-react'
import { message, Spin } from 'antd'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
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


interface MdPreviewProps {
  /** 相对项目根目录的 markdown 文件路径，如 docs/overview.md */
  path: string
  /** 点击文档内相对链接时回调，用于文档间跳转 */
  onNavigate?: (path: string) => void
}

/** 将文档内的相对路径解析为相对项目根目录的路径（归一化 ./ ../） */
function resolveRelPath(base: string, rel: string): string {
  const stack = base ? base.split('/') : []
  for (const seg of rel.split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') stack.pop()
    else stack.push(seg)
  }
  return stack.join('/')
}

/**
 * Markdown 预览组件
 * 读取 workspace 内（通常为 docs/ 下）的 markdown 文件并渲染为 HTML
 */
export const MdPreview = ({ path, onNavigate }: MdPreviewProps) => {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

  // 读取文件内容
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setContent('')
    fetch(`/api/editor/content?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.status === 'success') {
          setContent(data.data.content || '')
        } else {
          setError(data.error || '读取失败')
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || '读取失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  // marked 编译：相对图片重写为 /api/docs/asset 资源地址；再 DOMPurify 消毒
  const html = useMemo(() => {
    if (!content) return ''
    const renderer = new marked.Renderer()
    renderer.image = ({ href, title, text }) => {
      let src = href
      if (src && !/^(https?:|data:)/.test(src)) {
        src = `/api/docs/asset?path=${encodeURIComponent(resolveRelPath(dir, src))}`
      }
      let out = `<img src="${src}" alt="${text}"`
      if (title) out += ` title="${title}"`
      return `${out} />`
    }
    const raw = marked.parse(content, { async: false, gfm: true, renderer })
    return DOMPurify.sanitize(raw)
  }, [content, dir])

  // 拦截相对链接：在同目录下解析目标文档并触发跳转
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || /^(https?:|mailto:|#)/.test(href)) return
      e.preventDefault()
      onNavigate?.(resolveRelPath(dir, href))
    }
    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [path, dir, onNavigate, html])

  return (
    <div ref={containerRef} className={styles.mdPreview}>
      {loading ? (
        <div className={styles.mdLoading}>
          <Spin size="small" />
        </div>
      ) : error ? (
        <div className={styles.mdError}>{error}</div>
      ) : (
        <div className={styles.mdBody} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  )
}