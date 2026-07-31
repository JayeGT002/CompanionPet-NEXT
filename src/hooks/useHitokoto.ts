/**
 * 一言发言调度 Hook — 支持一言 API / 本地兜底切换
 */

import { useCallback, useRef, useEffect } from 'react'

const FALLBACK_QUOTES = [
  '今天也是元气满满的一天呢~', '主人辛苦了，休息一下吧', '别忘了喝水哦',
  '生活不止眼前的代码，还有远方的美食', '晚安，愿你好梦', '加油，你是最棒的！',
  '窗外天气不错，要不要出去走走？', '一个人也要好好吃饭呀',
  '今天的努力，是明天的伏笔', '做自己喜欢的事，就是最大的幸福',
  '你若盛开，蝴蝶自来', '保持热爱，奔赴山海', '星光不问赶路人',
  '慢慢来，比较快', '心有猛虎，细嗅蔷薇',
]

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const log = (...args: any[]) => console.log(`[${new Date().toISOString()}] [Hitokoto]`, ...args)

const recentQuotes: string[] = []
const MAX_CACHE = 20

async function fetchHitokoto(): Promise<string> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    try {
      const result = await invoke<string>('fetch_hitokoto', { category: 'all' })
      return result
    } catch (e) {
      log('Tauri 获取一言失败:', e)
      return ''
    }
  }
  try {
    const res = await fetch('https://v1.hitokoto.cn/?c=a&c=j&c=k&c=f&c=d&c=i')
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    return data.hitokoto || ''
  } catch (e) {
    return ''
  }
}

async function getUniqueQuote(): Promise<string> {
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

interface UseHitokotoOptions {
  enabled: boolean
  hitokotoEnabled: boolean
  interval: number
  fallbackSpeeches: string[]
  onSpeak: (text: string) => void
}

export function useHitokoto(opts: UseHitokotoOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 用 ref 存储动态值，避免闭包捕获过期状态
  const optsRef = useRef(opts)
  optsRef.current = opts

  const getQuote = useCallback(async (): Promise<string> => {
    const { hitokotoEnabled, fallbackSpeeches } = optsRef.current
    if (hitokotoEnabled) {
      const quote = await getUniqueQuote()
      if (quote) {
        log('一言:', quote.slice(0, 20))
        return quote
      }
      // 一言获取失败 → 降级到本地
    }
    // 本地兜底
    const speeches = fallbackSpeeches.length > 0 ? fallbackSpeeches : FALLBACK_QUOTES
    const text = speeches[Math.floor(Math.random() * speeches.length)]
    log('本地发言:', text.slice(0, 20))
    return text
  }, [])

  const scheduleNext = useCallback(() => {
    const { enabled, interval } = optsRef.current
    if (!enabled) return
    const jitter = 0.8 + Math.random() * 0.4
    const ms = interval * 1000 * jitter
    timerRef.current = setTimeout(async () => {
      const quote = await getQuote()
      optsRef.current.onSpeak(quote)
      scheduleNext()
    }, ms)
  }, [getQuote])

  useEffect(() => {
    if (opts.enabled) {
      scheduleNext()
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [opts.enabled, opts.interval, scheduleNext])
}
