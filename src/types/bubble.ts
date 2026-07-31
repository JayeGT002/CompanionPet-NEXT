/**
 * 气泡消息项
 */
export interface BubbleMessage {
  id: string
  text: string
  type: 'plain' | 'interactive' | 'input'
  priority: 'high' | 'normal' | 'low'
  duration: number
  createdAt: number
}
