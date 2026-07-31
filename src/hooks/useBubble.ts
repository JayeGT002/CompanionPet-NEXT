/**
 * 气泡队列管理 Hook
 *
 * 管理气泡消息的生命周期：
 *   - 消息入队（按优先级 + FIFO）
 *   - 自动定时消失
 *   - 鼠标悬停暂停倒计时
 *   - 点击立即关闭
 *   - 队列最大长度 10
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { BubbleMessage } from '../types/bubble'

const MAX_QUEUE_SIZE = 10
let nextId = 0

export function useBubble() {
  const [queue, setQueue] = useState<BubbleMessage[]>([])
  const [currentBubble, setCurrentBubble] = useState<BubbleMessage | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoveredRef = useRef(false)
  const remainingRef = useRef(0)

  /** 清除当前定时器 */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** 播放下一个气泡 */
  const playNext = useCallback(() => {
    clearTimer()
    setQueue((prev) => {
      if (prev.length === 0) {
        setCurrentBubble(null)
        return prev
      }
      const sorted = [...prev].sort((a, b) => {
        const order = { high: 0, normal: 1, low: 2 }
        const po = order[a.priority] - order[b.priority]
        if (po !== 0) return po
        return a.createdAt - b.createdAt
      })
      const next = sorted[0]
      setCurrentBubble(next)
      remainingRef.current = next.duration * 1000

      if (!isHoveredRef.current) {
        timerRef.current = setTimeout(() => {
          playNext()
        }, next.duration * 1000)
      }

      return sorted.slice(1)
    })
  }, [clearTimer])

  /** 显示气泡 */
  const showBubble = useCallback(
    (
      text: string,
      options?: Partial<Pick<BubbleMessage, 'priority' | 'duration' | 'type'>>
    ) => {
      const msg: BubbleMessage = {
        id: `bubble-${nextId++}`,
        text,
        type: options?.type ?? 'plain',
        priority: options?.priority ?? 'normal',
        duration: options?.duration ?? 6,
        createdAt: Date.now(),
      }

      setQueue((prev) => {
        if (prev.length >= MAX_QUEUE_SIZE) {
          // 丢弃最低优先级最早项
          const sorted = [...prev].sort((a, b) => {
            const order = { high: 0, normal: 1, low: 2 }
            const po = order[a.priority] - order[b.priority]
            if (po !== 0) return po
            return a.createdAt - b.createdAt
          })
          return [...sorted.slice(1), msg]
        }
        if (!currentBubble) {
          // 当前无气泡，立即播放
          const sorted = [...prev, msg].sort((a, b) => {
            const order = { high: 0, normal: 1, low: 2 }
            const po = order[a.priority] - order[b.priority]
            if (po !== 0) return po
            return a.createdAt - b.createdAt
          })
          const next = sorted[0]
          setCurrentBubble(next)
          remainingRef.current = next.duration * 1000
          timerRef.current = setTimeout(() => {
            playNext()
          }, next.duration * 1000)
          return sorted.slice(1)
        }
        return [...prev, msg]
      })
    },
    [currentBubble, playNext]
  )

  /** 关闭当前气泡 */
  const dismissBubble = useCallback(() => {
    clearTimer()
    setCurrentBubble(null)
  }, [clearTimer])

  /** 打断当前气泡并立即显示新内容 */
  const interruptBubble = useCallback(
    (
      text: string,
      options?: Partial<Pick<BubbleMessage, 'priority' | 'duration' | 'type'>>
    ) => {
      clearTimer()
      const msg: BubbleMessage = {
        id: `bubble-${nextId++}`,
        text,
        type: options?.type ?? 'plain',
        priority: options?.priority ?? 'normal',
        duration: options?.duration ?? 6,
        createdAt: Date.now(),
      }
      setQueue([])
      setCurrentBubble(msg)
      remainingRef.current = msg.duration * 1000
      timerRef.current = setTimeout(() => {
        playNext()
      }, msg.duration * 1000)
    },
    [clearTimer, playNext]
  )

  // 当前气泡消失后播放下一个
  useEffect(() => {
    if (!currentBubble && queue.length > 0) {
      playNext()
    }
  }, [currentBubble, queue.length, playNext])

  /** 标记鼠标悬停 */
  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true
    clearTimer()
  }, [clearTimer])

  /** 标记鼠标离开，恢复倒计时 */
  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false
    if (currentBubble && remainingRef.current > 0) {
      timerRef.current = setTimeout(() => {
        playNext()
      }, remainingRef.current)
    }
  }, [currentBubble, playNext])

  return {
    currentBubble,
    showBubble,
    dismissBubble,
    interruptBubble,
    handleMouseEnter,
    handleMouseLeave,
  }
}
