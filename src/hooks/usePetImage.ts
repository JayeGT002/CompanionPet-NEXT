/**
 * 宠物图片管理 Hook
 */

import { useState, useEffect } from 'react'
import { getImportedImage } from '../services/imageApi'
import { getBuiltInPets } from '../hooks/useSettings'

const builtInNames = new Set(getBuiltInPets().map(p => p.name))

/** 获取宠物图片 URL */
export function getPetImageUrl(petName: string): string {
  // 仅对非内置宠物检查导入的图片
  if (!builtInNames.has(petName)) {
    const imported = getImportedImage(`${petName}.png`, 'pet') ?? getImportedImage(petName, 'pet')
    if (imported) return `data:image/png;base64,${imported}`
  }
  return `images/pets/${petName}.png`
}

export function usePetImage(petName: string) {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    setError(false)
    const url = getPetImageUrl(petName)
    setImageUrl(url)

    if (url.startsWith('images/')) {
      const img = new Image()
      img.onerror = () => setError(true)
      img.onload = () => setError(false)
      img.src = url
    }
  }, [petName])

  return { imageUrl, error }
}
