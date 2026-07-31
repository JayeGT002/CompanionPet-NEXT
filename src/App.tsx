/**
 * App 根组件 — 宠物窗口
 *   气泡为独立 Tauri 窗口，设置面板为独立 Tauri 窗口
 *
 * 设计要点：
 *   - bubble / settings 窗口在 tauri.conf.json 中已预定义并随应用启动创建
 *   - 这里通过 getByLabel 复用静态窗口，不再 close+new，避免 Tauri 2 的创建竞态
 *     （new WebviewWindow 立即返回 stub，未等 tauri://created 就调用 show/setPosition 会失效）
 */

import { useCallback, useEffect, useRef } from 'react'
import PetDisplay from './components/PetDisplay'
import SettingsPanel from './components/SettingsPanel'
import { useSpeech } from './hooks/useSpeech'
import { useSettings } from './hooks/useSettings'
import { savePetPosition } from './services/tauriApi'
import './App.css'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const isSettingsView = typeof window !== 'undefined' && window.location.search.includes('view=settings')

const log = (...args: any[]) => {
  const ts = new Date().toISOString()
  console.log(`[${ts}] [PetApp]`, ...args)
}

log('App 初始化, isTauri:', isTauri, 'isSettingsView:', isSettingsView)

// ---------- 气泡窗口管理 ----------

let bubbleTimer: ReturnType<typeof setTimeout> | null = null
let lastBubbleScale = 1
let lastImageOffsetY = 0

/** 获取预创建的 bubble 窗口（不重建） */
async function getBubbleWindow() {
  if (!isTauri) return null
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  return WebviewWindow.getByLabel('bubble')
}

/** 获取宠物窗口所在显示器的工作区逻辑边界（排除 Dock/任务栏，用于多屏夹紧） */
async function getMonitorLogicalBounds() {
  const { currentMonitor } = await import('@tauri-apps/api/window')
  try {
    const monitor = await currentMonitor()
    if (monitor) {
      // 优先用 workArea（已排除 Dock/任务栏）
      const wa = monitor.workArea
      const f = monitor.scaleFactor
      return {
        x: wa.position.x / f,
        y: wa.position.y / f,
        width: wa.size.width / f,
        height: wa.size.height / f,
      }
    }
  } catch { /* ignore */ }
  // 回退到主屏 avail 尺寸
  return {
    x: 0,
    y: 0,
    width: window.screen.availWidth,
    height: window.screen.availHeight,
  }
}

/**
 * 计算气泡应放置的逻辑坐标
 *
 * 设计原则：
 *   - 气泡箭头（底部中点）始终对准宠物窗口水平中心，不做水平夹紧
 *     即使气泡左右超出屏幕，箭头位置也不偏移
 *   - 垂直方向优先放图像上方；仅当气泡完全在屏幕外（不可见）时才改放下方
 *   - 不做垂直夹紧，允许气泡部分超出屏幕
 *
 * @param scale 宠物 config.scale
 * @param imageOffsetY PNG 图像在窗口内的纵向偏移（逻辑像素，0 表示图像紧贴窗口顶部）
 */
async function computeBubblePosition(scale: number, imageOffsetY: number = 0) {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const pet = getCurrentWindow()
  const factor = await pet.scaleFactor()
  const pos = await pet.outerPosition()
  const size = await pet.outerSize()

  // 物理 → 逻辑像素
  const lx = pos.x / factor
  const ly = pos.y / factor
  const lw = size.width / factor
  const lh = size.height / factor

  // 气泡窗口尺寸（逻辑像素）
  // 340×90 @ scale=1：能容纳约 3 行 12px 中文，与 128px 宠物窗口视觉协调
  const ds = Math.pow(Math.max(0.3, scale), 0.45)
  const bubbleW = Math.round(340 * ds)
  const bubbleH = Math.round(90 * ds)

  // 气泡水平居中于宠物窗口 → 箭头（bubble-body 底部中点）对准宠物中心
  // 不夹紧，允许超出屏幕
  const bx = lx + lw / 2 - bubbleW / 2

  // 图像在屏幕中的纵向位置
  const imageTopY = ly + imageOffsetY
  const imageBottomY = ly + lh - imageOffsetY

  // 垂直方向：优先放图像上方，气泡底部距图像顶部 5px
  let by = imageTopY - bubbleH - 5

  // 仅当气泡完全在屏幕上方（完全不可见）时，才改放图像下方
  const mon = await getMonitorLogicalBounds()
  if (by + bubbleH < mon.y) {
    by = imageBottomY + 5
  }
  // 不做夹紧，允许气泡部分超出屏幕边缘

  return { x: Math.round(bx), y: Math.round(by), width: bubbleW, height: bubbleH }
}

/** 将气泡窗口定位到宠物上方/下方并设置尺寸 */
async function positionBubbleOnPet(scale: number, imageOffsetY: number = 0) {
  if (!isTauri) return
  try {
    const win = await getBubbleWindow()
    if (!win) return
    const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/window')
    const { x, y, width, height } = await computeBubblePosition(scale, imageOffsetY)
    await win.setSize(new LogicalSize(width, height))
    await win.setPosition(new LogicalPosition(x, y))
  } catch (e) { log('气泡定位失败:', e) }
}

/** 更新气泡文本内容（通过 Rust 命令 eval 注入，避免重建窗口） */
async function setBubbleText(text: string, scale: number) {
  if (!isTauri) return
  const safe = JSON.stringify(text)
  const ds = Math.pow(Math.max(0.3, scale), 0.45)
  // 在气泡窗口里执行：更新文本 + 通过 CSS 变量调整缩放 + 重启子元素入场动画
  // 缩放用 --bubble-scale（作用在 #bubble 父元素），动画在 .bubble-content 子元素，互不干扰
  const js = `
    (function(){
      var t = document.getElementById('text');
      if (t) t.textContent = ${safe};
      var b = document.getElementById('bubble');
      if (b) {
        b.style.setProperty('--bubble-scale', ${ds});
      }
      var c = b && b.querySelector('.bubble-content');
      if (c) {
        c.classList.remove('bubble-content--in');
        void c.offsetWidth;
        c.classList.add('bubble-content--in');
      }
    })();
  `
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('eval_in_window', { label: 'bubble', code: js })
  } catch (e) { log('气泡文本注入失败:', e) }
}

async function showBubbleWindow(text: string, scale: number, duration: number, imageOffsetY: number = 0) {
  if (!isTauri) return
  log('显示气泡:', text.slice(0, 30))
  lastBubbleScale = scale
  lastImageOffsetY = imageOffsetY

  try {
    // 记录气泡显示前设置窗口是否拥有焦点，便于 show 后归还
    const settingsWin = await getSettingsWindow()
    let settingsWasFocused = false
    if (settingsWin) {
      try {
        settingsWasFocused = await settingsWin.isVisible() && await settingsWin.isFocused()
      } catch { /* ignore */ }
    }

    const win = await getBubbleWindow()
    if (!win) { log('未找到 bubble 窗口'); return }
    await setBubbleText(text, scale)
    await positionBubbleOnPet(scale, imageOffsetY)
    await win.show()

    // 气泡 show 可能抢走设置窗口焦点；若之前设置窗口是 focused，归还焦点
    if (settingsWasFocused && settingsWin) {
      try { await settingsWin.setFocus() } catch { /* ignore */ }
    }

    if (bubbleTimer) clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(async () => {
      try { await win.hide(); log('气泡自动隐藏') } catch { /* ignore */ }
    }, duration * 1000)
  } catch (e) { log('气泡显示异常:', e) }
}

async function hideBubbleWindow() {
  if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null }
  if (!isTauri) return
  try {
    const win = await getBubbleWindow()
    if (win) await win.hide()
  } catch { /* ignore */ }
}

// ---------- 设置窗口管理 ----------

/** 复用预创建的 settings 窗口（不重建） */
async function getSettingsWindow() {
  if (!isTauri) return null
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
  return WebviewWindow.getByLabel('settings')
}

async function showSettingsWindow() {
  if (!isTauri) return
  log('打开设置窗口')
  try {
    const win = await getSettingsWindow()
    if (!win) { log('未找到 settings 窗口'); return }
    await win.show()
    await win.setFocus()
    log('设置窗口已显示')
  } catch (e) { log('设置窗口显示异常:', e) }
}

async function hideSettingsWindow() {
  if (!isTauri) return
  try {
    const win = await getSettingsWindow()
    if (win) await win.hide()
  } catch { /* ignore */ }
}

// ====== 主组件 ======

export default function App() {
  if (isSettingsView) {
    return <SettingsPanelWindow />
  }

  const { config } = useSettings()
  const isDragging = useRef(false)
  const dragMoved = useRef(false) // 区分点击 vs 拖拽
  const dragOffset = useRef({ x: 0, y: 0 })
  const dragStart = useRef({ x: 0, y: 0 })

  // 宠物窗口跟随缩放动态调整大小：贴近 PNG 实际显示尺寸（128×128）
  // 不再使用 200×200 大窗口，避免气泡与可见像素之间隔着一圈透明 padding
  useEffect(() => {
    if (!isTauri) return
    // PNG 显示基准 128，浮动幅度上下各预留一半，避免浮动时被裁剪
    const floatPad = config.animationEnabled ? config.floatAmplitude : 0
    const size = Math.max(60, Math.ceil((128 + floatPad * 2) * config.scale))
    import('@tauri-apps/api/window').then(({ getCurrentWindow, LogicalSize }) => {
      getCurrentWindow().setSize(new LogicalSize(size, size)).catch(() => {})
    })
  }, [config.scale, config.floatAmplitude, config.animationEnabled])

  // PNG 图像在窗口内的纵向偏移（用于气泡贴近图像而非窗口边缘）
  // 窗口尺寸 = (128 + 2*floatAmplitude) * scale，图像居中 → 上下各 floatAmplitude*scale padding
  const imageOffsetY = config.animationEnabled ? config.floatAmplitude * config.scale : 0

  // 发言调度：一言 / LLM / 本地兜底（LLM 与一言互斥）
  const { getSpeechNow } = useSpeech({
    enabled: config.autoSpeakEnabled,
    hitokotoEnabled: config.hitokotoEnabled,
    llmEnabled: config.llmEnabled,
    interval: config.speakInterval,
    llmEndpoint: config.llmEndpoint,
    llmApiKey: config.llmApiKey,
    llmModel: config.llmModel,
    onSpeak: (text) => {
      log('主动发言:', text.slice(0, 30))
      showBubbleWindow(text, config.scale, 6, imageOffsetY)
    },
    onStatus: (text, duration) => {
      log('状态气泡:', text)
      showBubbleWindow(text, config.scale, duration, imageOffsetY)
    },
  })

  // 点击宠物 — 用 onClick（拖拽中 dragMoved=true 时跳过）
  // 点击与待机共用同一套文本（LLM 池 / 兜底文案）
  const handlePetClick = useCallback(async () => {
    if (dragMoved.current) return // 这是一次拖拽，不是点击
    const text = await getSpeechNow()
    log('点击宠物:', text.slice(0, 30))
    hideBubbleWindow()
    showBubbleWindow(text, config.scale, 4, imageOffsetY)
  }, [getSpeechNow, config.scale, imageOffsetY])

  // 暴露给托盘菜单（同时容错：托盘也可直接通过 Rust 端打开 settings 窗口）
  useEffect(() => {
    (window as any).__petShowSettings = showSettingsWindow
    return () => { delete (window as any).__petShowSettings }
  }, [])

  // ========= 窗口拖拽（带点击/拖拽区分） =========
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return

    // 阈值：移动超过 4px 才算拖拽
    const DRAG_THRESHOLD = 4

    const onMouseDown = (e: MouseEvent) => {
      // 仅响应主键（左键）
      if (e.button !== 0) return
      isDragging.current = true
      dragMoved.current = false
      dragStart.current = { x: e.screenX, y: e.screenY }
      if (isTauri) {
        import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
          const win = getCurrentWindow()
          const factor = await win.scaleFactor()
          const pos = await win.outerPosition()
          dragOffset.current = {
            x: e.screenX * factor - pos.x,
            y: e.screenY * factor - pos.y,
          }
        })
      } else {
        dragOffset.current = { x: e.clientX, y: e.clientY }
      }
    }

    const onMouseMove = async (e: MouseEvent) => {
      if (!isDragging.current) return
      // 判断是否超过阈值 → 标记为拖拽
      if (!dragMoved.current) {
        const dx = e.screenX - dragStart.current.x
        const dy = e.screenY - dragStart.current.y
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        dragMoved.current = true
      }
      e.preventDefault()
      if (isTauri) {
        const { getCurrentWindow, PhysicalPosition } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        const factor = await win.scaleFactor()
        const newX = e.screenX * factor - dragOffset.current.x
        const newY = e.screenY * factor - dragOffset.current.y
        // 用物理像素的屏幕尺寸做夹紧（screen.width 是 CSS 像素）
        const sw = window.screen.width * factor
        const sh = window.screen.height * factor
        const clampedX = Math.max(-100, Math.min(sw - 28, newX))
        const clampedY = Math.max(0, Math.min(sh - 28, newY))
        await win.setPosition(new PhysicalPosition(clampedX, clampedY))
        // 拖拽中更新气泡位置（不 await，避免阻塞）
        positionBubbleOnPet(lastBubbleScale, lastImageOffsetY)
      }
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      if (dragMoved.current && isTauri) {
        import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
          const win = getCurrentWindow()
          const pos = await win.outerPosition()
          savePetPosition(pos.x, pos.y)
        })
      }
    }

    root.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      root.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div className="app">
      <div className="app__pet-stage" onClick={handlePetClick}>
        <PetDisplay />
      </div>
    </div>
  )
}

/** 设置面板独立窗口组件 */
function SettingsPanelWindow() {
  // 外层透明：窗口 transparent:true，圆角与投影由 SettingsPanel 内层容器承担
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
      <SettingsPanel
        visible={true}
        embedded={true}
        onClose={async () => {
          await hideSettingsWindow()
        }}
      />
    </div>
  )
}
