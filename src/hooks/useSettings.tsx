/**
 * 设置管理 Context + Hook
 *
 * 所有组件通过 SettingsContext 共享同一份宠物配置状态，
 * 避免多实例导致的设置不生效问题。
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { PetConfig, PetInfo } from '../types'
import { getImportedPetImages } from '../services/imageApi'

/** 默认宠物配置 — 春兔作为所有版本默认宠物 */
export const DEFAULT_PET_CONFIG: PetConfig = {
  currentPet: '春兔',
  petName: '',
  scale: 1.0,
  opacity: 1.0,
  animationEnabled: true,
  floatAmplitude: 4,
  floatPeriod: 3,
  autoSpeakEnabled: true,
  speakInterval: 120,
  hitokotoEnabled: true,
  hitokotoCategory: 'all',
  llmEnabled: false,
  llmProvider: 'deepseek',
  llmEndpoint: 'https://api.deepseek.com/chat/completions',
  llmApiKey: '',
  llmModel: 'deepseek-chat',
  clickSpeeches: ['戳我干嘛~', '你好呀！', '有什么需要帮忙的吗？'],
  idleSpeeches: ['今天天气真好~', '好安静啊...', '主人还在吗？'],
  autoStartEnabled: false,
  hideDockIcon: false,
}

const STORAGE_KEY = 'companionpet_settings'

function loadConfig(): PetConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return { ...DEFAULT_PET_CONFIG, ...JSON.parse(raw) }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_PET_CONFIG }
}

function saveConfig(config: PetConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/** 获取内置宠物列表 */
export function getBuiltInPets(): PetInfo[] {
  const petFiles = [
    '友爱天天', '友爱星飞', '喵喵', '大耳帽兜', '大耳帽兜的异色',
    '小帕尔', '小黑猫', '护主犬', '春兔', '粉星仔', '粉星仔的异色',
    '黑猫密探', '黑猫巫师',
  ]
  return petFiles.map((name) => ({ name, path: `images/pets/${name}.png` }))
}

/** Settings Context 类型 */
interface SettingsContextValue {
  config: PetConfig
  allPets: PetInfo[]
  updateConfig: <K extends keyof PetConfig>(key: K, value: PetConfig[K]) => void
  refreshCustomPets: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/** Provider */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<PetConfig>(loadConfig)
  const [builtInPets] = useState<PetInfo[]>(getBuiltInPets)
  const [customPets, setCustomPets] = useState<PetInfo[]>([])

  useEffect(() => {
    const imported = getImportedPetImages()
    setCustomPets(imported.map((name) => ({ name, path: `/images/pets/${name}` })))
  }, [])

  const updateConfig = useCallback(<K extends keyof PetConfig>(key: K, value: PetConfig[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value }
      saveConfig(next)
      return next
    })
  }, [])

  // 跨窗口同步：监听其他窗口对 localStorage 的修改（设置窗口 → 宠物窗口）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as PetConfig
          setConfig({ ...DEFAULT_PET_CONFIG, ...parsed })
        } catch { /* ignore */ }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const refreshCustomPets = useCallback(() => {
    setCustomPets(getImportedPetImages().map((name) => ({ name, path: `images/pets/${name}` })))
  }, [])

  const allPets: PetInfo[] = [...builtInPets, ...customPets]

  return (
    <SettingsContext.Provider value={{ config, allPets, updateConfig, refreshCustomPets }}>
      {children}
    </SettingsContext.Provider>
  )
}

/** 消费 Hook — 在所有组件中调用此 Hook 获取共享状态 */
export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings 必须在 SettingsProvider 内部使用')
  }
  return ctx
}
