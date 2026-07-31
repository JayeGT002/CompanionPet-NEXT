/**
 * CompanionPet 核心类型定义
 */

/** 宠物窗口配置 */
export interface PetConfig {
  currentPet: string
  /** 宠物自定义名称 */
  petName: string
  scale: number
  opacity: number
  animationEnabled: boolean
  floatAmplitude: number
  floatPeriod: number
  /** 是否启用一言主动发言 */
  autoSpeakEnabled: boolean
  /** 发言间隔（秒），最小 30，最大 600 */
  speakInterval: number
  /** 一言设置 */
  hitokotoEnabled: boolean
  hitokotoCategory: string
  /** LLM 设置 */
  llmEnabled: boolean
  llmProvider: string
  llmEndpoint: string
  llmApiKey: string
  llmModel: string
  /** 本地兜底发言 */
  clickSpeeches: string[]
  idleSpeeches: string[]
  /** 开机自动启动 */
  autoStartEnabled: boolean
  /** Dock 栏隐藏图标（macOS） */
  hideDockIcon: boolean
}

/** 设置面板 Tab */
export type SettingsTab = 'pet' | 'general' | 'soul' | 'plugins' | 'about'

/** 可用的宠物列表项 */
export interface PetInfo {
  name: string
  path: string
}

/** 图片导入请求（本地操作） */
export interface ImageImportRequest {
  fileName: string
  data: string
  type: 'pet' | 'icon'
}

export interface ImageImportResponse {
  success: boolean
  filePath: string
  fileName: string
  error?: string
}

export interface SettingsPanelProps {
  visible: boolean
  onClose: () => void
  /** 独立窗口模式：不使用 dialog，直接内联渲染 */
  embedded?: boolean
}
