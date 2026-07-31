/**
 * 设置面板 5 个 Tab 视图
 * 逻辑与原 buildPetSettings/buildGeneral/buildSoul/buildPlugins/buildAbout 一一对应
 */

import type { PetConfig, PetInfo } from '../../types'
import { importPetImage, validateImageFile } from '../../services/imageApi'
import { applyAutoStart, setDockVisible } from '../../services/tauriApi'
import {
  SettingGroup,
  SettingRow,
  SettingStack,
  Switch,
  Slider,
  TextField,
  SelectField,
} from './controls'
import { PetGrid } from './PetGrid'

const HITOKOTO_CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'a', label: '动画' }, { value: 'b', label: '漫画' }, { value: 'c', label: '游戏' },
  { value: 'd', label: '文学' }, { value: 'e', label: '原创' }, { value: 'f', label: '来自网络' },
  { value: 'g', label: '其他' }, { value: 'h', label: '影视' }, { value: 'i', label: '诗词' },
  { value: 'j', label: '网易云' }, { value: 'k', label: '哲学' }, { value: 'l', label: '抖机灵' },
]

function isMacOS(): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '')
}

interface TabProps {
  config: PetConfig
  allPets: PetInfo[]
  updateConfig: <K extends keyof PetConfig>(key: K, value: PetConfig[K]) => void
  refreshCustomPets: () => void
}

/* ===================== 宠物设置 ===================== */

export function PetTab({ config, allPets, updateConfig, refreshCustomPets }: TabProps) {
  const handleImport = () => {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = 'image/png,image/jpeg,image/webp,image/gif'
    i.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      const v = validateImageFile(f)
      if (!v.valid) { alert(v.error); return }
      const r = await importPetImage(f)
      if (r.success) refreshCustomPets(); else alert(r.error || '导入失败')
    }
    i.click()
  }

  return (
    <div>
      <SettingGroup title="基本">
        <SettingStack label="宠物名称">
          <TextField
            placeholder="给宠物起个名字…"
            value={config.petName}
            onChange={(v) => updateConfig('petName', v)}
          />
        </SettingStack>
      </SettingGroup>

      <SettingGroup title="外观">
        <SettingStack label="桌宠缩放">
          <Slider
            value={config.scale}
            min={0.5}
            max={3}
            step={0.1}
            format={(v) => `${v.toFixed(1)}×`}
            onChange={(v) => updateConfig('scale', v)}
          />
        </SettingStack>
        <SettingStack label="透明度">
          <Slider
            value={config.opacity}
            min={0.1}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => updateConfig('opacity', v)}
          />
        </SettingStack>
      </SettingGroup>

      {/* 宠物选择 + 自定义导入合并区（位于面板最下方） */}
      <div>
        <div className="cp-section-title">选择宠物</div>
        <div className="cp-group">
          <PetGrid
            pets={allPets}
            currentPet={config.currentPet}
            onSelect={(name) => updateConfig('currentPet', name)}
            onImport={handleImport}
          />
        </div>
        <div className="cp-hint">点击图片选择宠物；「自定义」可导入本地图片（PNG / JPEG / WebP / GIF，最大 10MB）</div>
      </div>
    </div>
  )
}

/* ===================== 通用设置 ===================== */

export function GeneralTab({ config, updateConfig }: TabProps) {
  return (
    <div>
      <SettingGroup title="启动">
        <SettingRow label="开机自动启动">
          <Switch
            checked={config.autoStartEnabled}
            onChange={(v) => { updateConfig('autoStartEnabled', v); applyAutoStart(v) }}
          />
        </SettingRow>
        {isMacOS() ? (
          <SettingRow label="Dock 栏隐藏图标（需重启生效）" sub>
            <Switch
              checked={config.hideDockIcon}
              onChange={(v) => { updateConfig('hideDockIcon', v); setDockVisible(!v) }}
            />
          </SettingRow>
        ) : null}
      </SettingGroup>

      <SettingGroup title="动画">
        <SettingRow label="待机浮动动画">
          <Switch
            checked={config.animationEnabled}
            onChange={(v) => updateConfig('animationEnabled', v)}
          />
        </SettingRow>
        <SettingStack label="浮动幅度">
          <Slider
            value={config.floatAmplitude}
            min={0}
            max={12}
            step={1}
            format={(v) => `${v}px`}
            onChange={(v) => updateConfig('floatAmplitude', v)}
          />
        </SettingStack>
        <SettingStack label="浮动周期">
          <Slider
            value={config.floatPeriod}
            min={1}
            max={6}
            step={0.5}
            format={(v) => `${v}s`}
            onChange={(v) => updateConfig('floatPeriod', v)}
          />
        </SettingStack>
      </SettingGroup>
    </div>
  )
}

/* ===================== 灵魂设置 ===================== */

export function SoulTab({ config, updateConfig }: TabProps) {
  // 一言与 LLM 互斥：开启一方时关闭另一方（二者只能二选一）
  const toggleHitokoto = (v: boolean) => {
    updateConfig('hitokotoEnabled', v)
    if (v) updateConfig('llmEnabled', false)
  }
  const toggleLlm = (v: boolean) => {
    updateConfig('llmEnabled', v)
    if (v) updateConfig('hitokotoEnabled', false)
  }

  return (
    <div>
      <SettingGroup title="发言节奏">
        <SettingStack label="输出文本间隔" hint="每次输出文本增加随机 0.5 到 2.3 倍的时长">
          <Slider
            value={config.speakInterval}
            min={15}
            max={3500}
            step={5}
            format={(v) => `${v}秒`}
            onChange={(v) => updateConfig('speakInterval', v)}
          />
        </SettingStack>
      </SettingGroup>

      <SettingGroup title="一言">
        <SettingRow label="启用一言">
          <Switch
            checked={config.hitokotoEnabled}
            onChange={toggleHitokoto}
          />
        </SettingRow>
        {config.hitokotoEnabled ? (
          <SettingStack label="一言分类">
            <SelectField
              value={config.hitokotoCategory}
              options={HITOKOTO_CATEGORIES}
              onChange={(v) => updateConfig('hitokotoCategory', v)}
            />
          </SettingStack>
        ) : (
          <div className="cp-hint" style={{ padding: '0 14px 4px' }}>
            一言与下方「LLM 文案」互斥，同一时间只能开启其一。
          </div>
        )}
      </SettingGroup>

      <SettingGroup title="LLM 文案">
        <SettingRow label="启用 LLM 文案">
          <Switch
            checked={config.llmEnabled}
            onChange={toggleLlm}
          />
        </SettingRow>
        {config.llmEnabled ? (
          <>
            <div className="cp-hint" style={{ padding: '0 14px 4px' }}>
              启用后按内置提示词一次生成 60 条文案用于发言，与一言互斥。生成期间气泡提示「正在胡编乱造中……」，完成提示「胡编乱造完成！」。
            </div>
            <SettingStack label="LLM 名称">
              <TextField
                placeholder="DeepSeek / OpenAI / 自定义..."
                value={config.llmProvider}
                onChange={(v) => updateConfig('llmProvider', v)}
              />
            </SettingStack>
            <SettingStack label="API 地址">
              <TextField
                placeholder="https://api.deepseek.com/chat/completions"
                value={config.llmEndpoint}
                onChange={(v) => updateConfig('llmEndpoint', v)}
              />
            </SettingStack>
            <SettingStack label="API Key">
              <TextField
                type="password"
                placeholder="sk-..."
                value={config.llmApiKey}
                onChange={(v) => updateConfig('llmApiKey', v)}
              />
            </SettingStack>
            <SettingStack label="模型">
              <TextField
                placeholder="deepseek-chat"
                value={config.llmModel}
                onChange={(v) => updateConfig('llmModel', v)}
              />
            </SettingStack>
          </>
        ) : null}
      </SettingGroup>

      <SettingGroup title="兜底文案">
        <div className="cp-hint" style={{ padding: '4px 14px' }}>
          当一言 / LLM 不可用时，从内置兜底文案中随机选取。点击与待机共用同一套文案（来自 兜底文案.txt，不可自定义）。
        </div>
      </SettingGroup>
    </div>
  )
}

/* ===================== 插件 ===================== */

export function PluginsTab() {
  return <div className="cp-coming-soon">Coming Soon…</div>
}

/* ===================== 关于 ===================== */

export function AboutTab() {
  return (
    <div className="cp-about">
      <img className="cp-about__icon" src="images/icons/app-icon.png" alt="伴星" />
      <div className="cp-about__title">伴星 CompanionPet</div>
      <div className="cp-about__ver">v0.1-beta</div>
      <div
        className="cp-about__lyric"
        dangerouslySetInnerHTML={{
          __html: '我属于火山口&emsp;生命之中&emsp;注定一场重逢<br/>最初最终&emsp;我都与你相拥<br/><span>JUSF周存/洛天依《我属于火山口》</span>',
        }}
      />
      <div className="cp-about__tech">Tauri 2.x · React · TypeScript</div>
    </div>
  )
}
