import { useState, useRef, useEffect } from 'react'
import { useReactFlow, useViewport, Panel } from '@xyflow/react'
import type { PanelProps } from '@xyflow/react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { InputNumber } from 'antd'
import styles from './index.module.scss'

export const Controls = (props: PanelProps) => {
  const { zoom } = useViewport()
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  // 全局键盘快捷键: Ctrl++ / Ctrl+-
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          zoomIn()
        } else if (e.key === '-') {
          e.preventDefault()
          zoomOut()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomIn, zoomOut])

  return (
    <Panel {...props}>
      <div className={styles.controls}>
        <button
          className={styles.btn}
          onClick={() => zoomIn()}
          aria-label="放大"
        >
          <ZoomIn size={16} />
        </button>

        {editing ? (
          <InputNumber<number>
            ref={inputRef as any}
            size="small"
            min={10}
            max={500}
            formatter={(value) => `${value}%`}
            value={Math.round(zoom * 100)}
            onChange={(v) => {
              if (v !== null) {
                zoomTo(v / 100)
              }
            }}
            onBlur={() => setEditing(false)}
            onPressEnter={() => setEditing(false)}
            style={{ width: 70 }}
          />
        ) : (
          <span className={styles.zoomLabel} onClick={() => setEditing(true)}>
            {Math.round(zoom * 100)}%
          </span>
        )}

        <button
          className={styles.btn}
          onClick={() => zoomOut()}
          aria-label="缩小"
        >
          <ZoomOut size={16} />
        </button>
      </div>
    </Panel>
  )
}
