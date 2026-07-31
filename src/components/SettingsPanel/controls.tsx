/**
 * 设置面板可复用基元组件 — 全部声明式 JSX
 * 交互逻辑与原 imperative DOM 版本一致
 */

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode, KeyboardEvent } from 'react'

/* ---------- 分组卡片 ---------- */

export function SettingGroup({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <div>
      {title ? <div className="cp-section-title">{title}</div> : null}
      <div className="cp-group">{children}</div>
    </div>
  )
}

/** 行：label 在左，control 在右，两端对齐 */
export function SettingRow({
  label,
  sub,
  children,
}: {
  label: string
  sub?: boolean
  children: ReactNode
}) {
  return (
    <div className="cp-row">
      <span className={`cp-row__label${sub ? ' cp-row__label--sub' : ''}`}>{label}</span>
      <div className="cp-row__control">{children}</div>
    </div>
  )
}

/** 堆叠块：label 在上，控件在下（用于输入框/下拉/滑块） */
export function SettingStack({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="cp-stack">
      <label className="cp-stack__label">{label}</label>
      {children}
      {hint ? <div className="cp-stack__hint">{hint}</div> : null}
    </div>
  )
}

/* ---------- Switch ---------- */

export function Switch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <input
      type="checkbox"
      className="cp-switch"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}

/* ---------- Slider（保留点击数值可编辑） ---------- */

export function Slider({
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const editRef = useRef<HTMLInputElement | null>(null)

  // 同步外部 value 变化到显示
  useEffect(() => {
    if (!editing) setDraft(String(value))
  }, [value, editing])

  const commit = () => {
    let v = parseFloat(draft)
    if (isNaN(v)) v = value
    v = Math.max(min, Math.min(max, v))
    setEditing(false)
    onChange(v)
  }

  const startEdit = () => {
    setDraft(String(value))
    setEditing(true)
  }

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus()
      editRef.current.select()
    }
  }, [editing])

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className="cp-slider-row">
      <input
        className="cp-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
      />
      {editing ? (
        <input
          ref={editRef}
          className="cp-val-edit"
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          style={{ width: `${Math.max(48, String(draft).length * 9 + 18)}px` }}
        />
      ) : (
        <span className="cp-val-inline" title="点击修改数值" onClick={startEdit}>
          {format(value)}
        </span>
      )}
    </div>
  )
}

/* ---------- TextField（text / password 合并） ---------- */

export function TextField({
  type = 'text',
  placeholder,
  value,
  onChange,
}: {
  type?: 'text' | 'password'
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) {
  // 保留原 change 语义：仅在失焦/Enter 时提交，避免每次按键写 localStorage
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const commit = () => onChange(draft)

  return (
    <input
      className="cp-input"
      type={type}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

/* ---------- SelectField ---------- */

export function SelectField<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <select className="cp-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* ---------- SpeechTextarea（发言列表，含行数计数） ---------- */

export function SpeechTextarea({
  items,
  onUpdate,
}: {
  items: string[]
  onUpdate: (items: string[]) => void
}) {
  const [text, setText] = useState(items.join('\n'))
  const [count, setCount] = useState(() =>
    items.filter((s) => s.trim().length > 0).length
  )

  // 外部 items 变化时同步（如 LLM 生成后追加）
  useEffect(() => {
    const joined = items.join('\n')
    setText(joined)
    setCount(items.filter((s) => s.trim().length > 0).length)
  }, [items])

  const recompute = (raw: string) => {
    const lines = raw.split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
    setCount(lines.length)
  }

  return (
    <div className="cp-speech-card">
      <div className="cp-speech-card__header">
        <span className="cp-speech-card__title">发言列表</span>
        <span className="cp-speech-card__count">{count} 条</span>
      </div>
      <textarea
        className="cp-speech-textarea"
        placeholder="每行一条发言，支持批量粘贴"
        value={text}
        onChange={(e) => { setText(e.target.value); recompute(e.target.value) }}
        onBlur={(e) => {
          const lines = e.target.value.split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
          onUpdate(lines)
        }}
        onKeyDown={(e) => {
          // Cmd/Ctrl+A 不冒泡，避免触发其他快捷键
          if ((e.metaKey || e.ctrlKey) && e.key === 'a') e.stopPropagation()
        }}
      />
      <div className="cp-speech-hint">右键可粘贴多行内容，每行自动识别为一条发言</div>
    </div>
  )
}
