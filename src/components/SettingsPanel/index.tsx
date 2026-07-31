/**
 * 设置面板 — macOS 系统设置风格
 *   左侧侧栏（图标 + 文字）+ 右侧分组卡片内容
 *   顶部自绘 titlebar：data-tauri-drag-region 拖拽 + 红圆点关闭按钮
 *   embedded 模式：独立 Tauri 窗口内联渲染
 */

import { useState } from 'react'
import type { SettingsPanelProps, SettingsTab } from '../../types'
import { useSettings } from '../../hooks/useSettings'
import { PetTab, GeneralTab, SoulTab, PluginsTab, AboutTab } from './tabs'
import './SettingsPanel.css'

type TabDef = { key: SettingsTab; label: string; icon: JSX.Element }

/* SF Symbols 风格单色 SVG 图标（stroke = currentColor，随选中态变色） */
const PawIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="4" r="2" />
    <circle cx="18" cy="8" r="2" />
    <circle cx="20" cy="16" r="2" />
    <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
  </svg>
)
const GearIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)
const SoulIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)
const PuzzleIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
  </svg>
)
const InfoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const TABS: TabDef[] = [
  { key: 'pet', label: '宠物', icon: PawIcon },
  { key: 'general', label: '通用', icon: GearIcon },
  { key: 'soul', label: '灵魂', icon: SoulIcon },
  { key: 'plugins', label: '插件', icon: PuzzleIcon },
  { key: 'about', label: '关于', icon: InfoIcon },
]

export default function SettingsPanel({ visible, onClose, embedded }: SettingsPanelProps) {
  const s = useSettings()
  const [activeTab, setActiveTab] = useState<SettingsTab>('pet')

  if (!embedded || !visible) return null

  const renderTab = () => {
    const props = {
      config: s.config,
      allPets: s.allPets,
      updateConfig: s.updateConfig,
      refreshCustomPets: s.refreshCustomPets,
    }
    switch (activeTab) {
      case 'pet': return <PetTab {...props} />
      case 'general': return <GeneralTab {...props} />
      case 'soul': return <SoulTab {...props} />
      case 'plugins': return <PluginsTab />
      case 'about': return <AboutTab />
    }
  }

  return (
    <div className="cp-root">
      {/* Titlebar */}
      <div className="cp-titlebar" data-tauri-drag-region>
        <button
          className="cp-titlebar__close"
          title="关闭"
          onClick={(e) => { e.stopPropagation(); onClose() }}
        />
        <span className="cp-titlebar__title">伴星 设置</span>
      </div>

      {/* Main: sidebar + content */}
      <div className="cp-main">
        <nav className="cp-sidebar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`cp-tab${activeTab === tab.key ? ' cp-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="cp-tab__icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="cp-content">
          <div className="cp-tab-body">{renderTab()}</div>
          <div className="cp-footer">
            <button className="cp-btn cp-btn-p" onClick={() => onClose()}>关闭</button>
          </div>
        </div>
      </div>
    </div>
  )
}
