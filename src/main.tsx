/**
 * CompanionPet 应用入口 — 多窗口架构
 *   pet 窗口 → App (宠物)
 *   settings 窗口 → App (设置面板)
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SettingsProvider } from './hooks/useSettings'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('找不到 root 节点')

createRoot(root).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>
)
