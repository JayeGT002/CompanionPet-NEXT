/**
 * 发言调度 Hook — 一言 / LLM / 本地兜底三种来源
 *
 * 规则：
 *   - LLM 与一言互斥（由 UI 保证二者不同时开启；这里以 llmEnabled 优先）
 *   - LLM 模式：维护一个文案池，池空时调用后端生成 60 条
 *       · 生成期间气泡提示「正在胡编乱造中……」
 *       · 生成完成气泡提示「胡编乱造完成！」
 *       · 生成失败则降级到兜底文案
 *   - 兜底文案统一来自 兜底文案.txt（点击与待机共用同一套）
 */

import { useCallback, useEffect, useRef } from 'react'
import fallbackRaw from '../../兜底文案.txt?raw'
import { generateLLMSpeeches } from '../services/tauriApi'

/** 兜底文案（编译期由 Vite 以 ?raw 内联） */
const FALLBACK_SPEECHES: string[] = fallbackRaw
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 0)

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const log = (...args: any[]) => console.log(`[${new Date().toISOString()}] [Speech]`, ...args)

/** 一言去重缓存，避免短期重复 */
const recentQuotes: string[] = []
const MAX_CACHE = 20

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function pickRandom(list: string[]): string {
  if (list.length === 0) return ''
  return list[Math.floor(Math.random() * list.length)]
}

async function fetchHitokoto(): Promise<string> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      return await invoke<string>('fetch_hitokoto', { category: 'all' })
    } catch (e) {
      log('Tauri 获取一言失败:', e)
      return ''
    }
  }
  // 浏览器开发环境：直接请求一言 API
  try {
    const res = await fetch('https://v1.hitokoto.cn/?c=a&c=j&c=k&c=f&c=d&c=i')
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    return data.hitokoto || ''
  } catch {
    return ''
  }
}

async function getUniqueHitokoto(): Promise<string> {
  let quote = ''
  for (let i = 0; i < 3; i++) {
    quote = await fetchHitokoto()
    if (quote && !recentQuotes.includes(quote)) break
  }
  if (quote) {
    recentQuotes.push(quote)
    if (recentQuotes.length > MAX_CACHE) recentQuotes.shift()
  }
  return quote
}

interface UseSpeechOptions {
  /** 总开关：是否自动发言 */
  enabled: boolean
  hitokotoEnabled: boolean
  llmEnabled: boolean
  /** 发言间隔（秒） */
  interval: number
  llmEndpoint: string
  llmApiKey: string
  llmModel: string
  /** 正常发言回调 */
  onSpeak: (text: string) => void
  /** 状态气泡回调（生成中 / 完成等），duration 单位秒 */
  onStatus: (text: string, duration: number) => void
}

export function useSpeech(opts: UseSpeechOptions) {
  // 用 ref 存动态值，避免闭包捕获过期状态
  const optsRef = useRef(opts)
  optsRef.current = opts
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** LLM 生成的文案池 */
  const poolRef = useRef<string[]>([])
  /** 正在进行中的生成 Promise（用于去重，避免并发生成） */
  const generatingPromiseRef = useRef<Promise<void> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const pickFromPool = useCallback((): string => {
    const pool = poolRef.current
    if (pool.length === 0) return ''
    const idx = Math.floor(Math.random() * pool.length)
    return pool.splice(idx, 1)[0]
  }, [])

  /**
   * 生成一批 LLM 文案（60 条）填入池中。
   * 期间通过气泡提示状态；生成中并发调用会复用同一个 Promise。
   */
  const fillPool = useCallback(async (): Promise<void> => {
    if (generatingPromiseRef.current) return generatingPromiseRef.current
    if (poolRef.current.length > 0) return

    const { llmEndpoint, llmApiKey, llmModel, onStatus } = optsRef.current
    const p = (async () => {
      onStatus('正在胡编乱造中……', 300)
      try {
        const lines = await generateLLMSpeeches(llmEndpoint, llmApiKey, llmModel)
        // 生成期间可能已切换离开 LLM 模式，丢弃结果
        if (!optsRef.current.llmEnabled) {
          poolRef.current = []
          return
        }
        poolRef.current = lines
        log('LLM 生成完成，共', lines.length, '条')
        onStatus('胡编乱造完成！', 3)
        await sleep(2500) // 让「完成」提示停留一会儿
      } catch (e: any) {
        log('LLM 生成失败:', e)
        poolRef.current = []
        if (optsRef.current.llmEnabled) {
          onStatus('胡编乱造失败，使用兜底文案', 3)
          await sleep(1800)
        }
      }
    })()
    generatingPromiseRef.current = p
    await p
    generatingPromiseRef.current = null
  }, [])

  /** 待机自动发言取一条：LLM 优先 → 一言 → 兜底 */
  const getQuote = useCallback(async (): Promise<string> => {
    const { llmEnabled, hitokotoEnabled } = optsRef.current
    if (llmEnabled) {
      await fillPool()
      const line = pickFromPool()
      if (line) return line
      return pickRandom(FALLBACK_SPEECHES)
    }
    if (hitokotoEnabled) {
      const q = await getUniqueHitokoto()
      if (q) return q
      return pickRandom(FALLBACK_SPEECHES)
    }
    return pickRandom(FALLBACK_SPEECHES)
  }, [fillPool, pickFromPool])

  /**
   * 点击发言取一条：与待机共用同一套文本。
   * LLM 模式下若池中有文案则从池中取（不触发生成，避免点击卡顿）；
   * 否则使用兜底文案。
   */
  const getSpeechNow = useCallback(async (): Promise<string> => {
    const { llmEnabled } = optsRef.current
    if (llmEnabled && poolRef.current.length > 0) {
      return pickFromPool()
    }
    return pickRandom(FALLBACK_SPEECHES)
  }, [pickFromPool])

  const scheduleNext = useCallback(() => {
    const { enabled, interval } = optsRef.current
    if (!enabled) return
    const jitter = 0.8 + Math.random() * 0.4
    const ms = interval * 1000 * jitter
    timerRef.current = setTimeout(async () => {
      const q = await getQuote()
      optsRef.current.onSpeak(q)
      scheduleNext()
    }, ms)
  }, [getQuote])

  /**
   * 启用 / 模式切换时启动调度。
   * 首次以较短延迟触发，便于 LLM 模式尽快显示「正在胡编乱造中……」。
   * 离开 LLM 模式时清空文案池，保证再次启用时重新生成。
   */
  useEffect(() => {
    if (!opts.enabled) {
      clearTimer()
      return
    }
    if (!opts.llmEnabled) {
      poolRef.current = []
    }
    let cancelled = false
    timerRef.current = setTimeout(async () => {
      const q = await getQuote()
      if (cancelled) return
      optsRef.current.onSpeak(q)
      scheduleNext()
    }, 400)
    return () => {
      cancelled = true
      clearTimer()
    }
  }, [opts.enabled, opts.llmEnabled, opts.hitokotoEnabled, getQuote, scheduleNext, clearTimer])

  return { getSpeechNow }
}
