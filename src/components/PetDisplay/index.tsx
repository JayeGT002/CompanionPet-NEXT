/**
 * 宠物展示组件 — 移除设置按钮，仅通过托盘进入设置
 */

import { useMemo } from 'react'
import { usePetImage } from '../../hooks/usePetImage'
import { useSettings } from '../../hooks/useSettings'
import './PetDisplay.css'

export default function PetDisplay() {
  const { config } = useSettings()
  const { imageUrl, error } = usePetImage(config.currentPet)

  const floatVars = useMemo<React.CSSProperties>(
    () => ({
      '--float-amplitude': `${config.floatAmplitude}px`,
      '--float-period': `${config.floatPeriod}s`,
    } as React.CSSProperties),
    [config.floatAmplitude, config.floatPeriod]
  )

  const floatClass = config.animationEnabled ? 'pet-float--active' : ''

  return (
    <div
      className="pet-container"
      style={{
        opacity: config.opacity,
        transform: `scale(${config.scale})`,
        transition: 'transform 0.15s ease, opacity 0.3s ease',
      }}
    >
      <div className={`pet-float ${floatClass}`} style={floatVars}>
        {error ? (
          <div className="pet-placeholder">?</div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={config.currentPet}
            draggable={false}
            className="pet-image"
          />
        ) : (
          <div className="pet-placeholder">...</div>
        )}
      </div>
    </div>
  )
}
