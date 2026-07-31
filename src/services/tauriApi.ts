/**
 * Tauri API 桥接层
 *
 * 封装所有 Tauri Command 调用，提供类型安全的接口。
 * 在浏览器环境下降级为 mock 实现。
 */

// ---------- 类型 ----------

export type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

// ---------- 检测 Tauri 环境 ----------

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const log = (...args: any[]) => console.log(`[${new Date().toISOString()}] [TauriApi]`, ...args)

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
    return tauriInvoke<T>(cmd, args)
  }
  // 浏览器 mock
  return mockInvoke<T>(cmd, args)
}

// ---------- Mock 实现 ----------

const mockStore = new Map<string, string>()

function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): T {
  switch (cmd) {
    case 'get_config_value':
      return (mockStore.get(args?.key as string) ?? null) as T
    case 'set_config_value':
      mockStore.set(args?.key as string, args?.value as string)
      return undefined as T
    case 'get_all_config':
      return Array.from(mockStore.entries()) as T
    case 'fetch_hitokoto':
      return '今天也是元气满满的一天呢~' as T
    case 'generate_llm_speeches':
      return [
        '主人今天好棒呀~',
        '记得多喝水哦',
        '今天的阳光真温暖',
        '主人辛苦了，休息一下吧',
        '有什么需要帮忙的吗？',
        '今天也要开心呀',
        '你说，星星会寂寞吗？',
        '我在呢，一直在你身边',
        '窗外的风景真好看',
        '晚安，做个好梦',
      ] as T
    case 'save_pet_position':
      return undefined as T
    case 'get_platform':
      return ((/Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? 'macos' : 'windows') as Platform) as T
    case 'apply_auto_start':
      return (args?.enable as boolean) as T
    default:
      return undefined as T
  }
}

// ---------- 对外 API ----------

/** 获取平台 */
export async function getPlatform(): Promise<Platform> {
  return invoke<Platform>('get_platform')
}

/** 获取配置值 */
export async function getConfigValue(key: string): Promise<string | null> {
  return invoke<string | null>('get_config_value', { key })
}

/** 设置配置值 */
export async function setConfigValue(key: string, value: string): Promise<void> {
  return invoke('set_config_value', { key, value })
}

/** 获取所有配置 */
export async function getAllConfig(): Promise<[string, string][]> {
  return invoke<[string, string][]>('get_all_config')
}

/** 获取一言 */
export async function fetchHitokoto(category?: string): Promise<string> {
  return invoke<string>('fetch_hitokoto', { category })
}

/** LLM 生成兜底发言 */
export async function generateLLMSpeeches(
  endpoint: string,
  apiKey: string,
  model: string
): Promise<string[]> {
  return invoke<string[]>('generate_llm_speeches', { endpoint, apiKey, model })
}

/** 保存宠物窗口位置 */
export async function savePetPosition(x: number, y: number): Promise<void> {
  log('保存宠物位置:', x, y)
  return invoke('save_pet_position', { x, y })
}

/** 设置鼠标穿透 */
export async function setClickThrough(enable: boolean): Promise<void> {
  log('设置鼠标穿透:', enable)
  return invoke('set_click_through', { enable })
}

/** 设置 Dock 图标可见性 */
export async function setDockVisible(visible: boolean): Promise<void> {
  return invoke('set_dock_visible', { visible })
}

/** 设置开机自启动（使用 Tauri autostart 插件） */
export async function applyAutoStart(enable: boolean): Promise<boolean> {
  log('设置开机自启动:', enable)
  if (isTauri) {
    const { enable: tauriEnable, disable: tauriDisable } = await import('@tauri-apps/plugin-autostart')
    if (enable) {
      await tauriEnable()
      log('开机自启动已启用')
    } else {
      await tauriDisable()
      log('开机自启动已禁用')
    }
    return enable
  }
  return enable
}
