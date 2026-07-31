/**
 * 宠物选择网格 — 相册式可视化选择
 *   上图下名，末尾追加「自定义」导入磁贴
 */

import { useEffect, useState } from 'react'
import type { PetInfo } from '../../types'
import { getPetImageUrl } from '../../hooks/usePetImage'

/** 显示名：去掉常见图片扩展名（仅展示用，不影响选择值） */
function displayName(name: string): string {
  return name.replace(/\.(png|jpe?g|webp|gif)$/i, '')
}

function PetTile({
  pet,
  selected,
  onSelect,
}: {
  pet: PetInfo
  selected: boolean
  onSelect: () => void
}) {
  const [src, setSrc] = useState(() => getPetImageUrl(pet.name))
  const [error, setError] = useState(false)

  // 切换宠物列表 / 同名图片更新时刷新
  useEffect(() => {
    setSrc(getPetImageUrl(pet.name))
    setError(false)
  }, [pet.name])

  const name = displayName(pet.name)

  return (
    <button
      type="button"
      className={`cp-pet-tile${selected ? ' cp-pet-tile--selected' : ''}`}
      onClick={onSelect}
      title={name}
    >
      <div className="cp-pet-tile__img-wrap">
        {error ? (
          <span className="cp-pet-tile__placeholder">?</span>
        ) : (
          <img
            className="cp-pet-tile__img"
            src={src}
            alt={name}
            draggable={false}
            onError={() => setError(true)}
          />
        )}
      </div>
      <span className="cp-pet-tile__name">{name}</span>
    </button>
  )
}

export function PetGrid({
  pets,
  currentPet,
  onSelect,
  onImport,
}: {
  pets: PetInfo[]
  currentPet: string
  onSelect: (name: string) => void
  onImport: () => void
}) {
  return (
    <div className="cp-pet-grid">
      {pets.map((p) => (
        <PetTile
          key={p.name}
          pet={p}
          selected={p.name === currentPet}
          onSelect={() => onSelect(p.name)}
        />
      ))}
      <button
        type="button"
        className="cp-pet-add"
        onClick={onImport}
        title="导入自定义宠物图片（PNG / JPEG / WebP / GIF，最大 10MB）"
      >
        <div className="cp-pet-add__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
        <span className="cp-pet-add__label">自定义</span>
      </button>
    </div>
  )
}
