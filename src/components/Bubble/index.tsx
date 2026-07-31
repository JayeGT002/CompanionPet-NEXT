/**
 * 气泡对话组件 — 内嵌在宠物窗口，固定位于宠物上方
 */

import type { BubbleMessage } from '../../types/bubble'
import './Bubble.css'

interface BubbleProps {
  message: BubbleMessage
  /** 宠物缩放比例，用于气泡内容大小跟随 */
  scale?: number
  /** 正在消失（播放淡出动画） */
  dismissing?: boolean
  onDismiss: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export default function Bubble({
  message,
  scale = 1,
  dismissing = false,
  onDismiss,
  onMouseEnter,
  onMouseLeave,
}: BubbleProps) {
  // 阻尼缩放：气泡内容温和跟随宠物大小
  const dampedScale = Math.pow(Math.max(0.3, scale), 0.45)

  return (
    <div
      className={`bubble ${dismissing ? 'bubble--dismissing' : ''}`}
      onClick={(e) => { e.stopPropagation(); onDismiss() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="bubble__body"
        style={{
          transform: `scale(${dampedScale})`,
          transformOrigin: 'bottom center',
        }}
      >
        <div className="bubble__inner">
          <div className="bubble__text">{message.text}</div>
        </div>
      </div>
    </div>
  )
}
