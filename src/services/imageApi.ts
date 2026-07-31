/**
 * 本地图片导入服务模块
 *
 * 提供用户自定义图片的本地导入 API 接口，支持后续扩展。
 * 所有操作均在本地完成，不涉及网络上传。
 * 当前网页开发阶段使用 localStorage 存储图片数据，
 * 后续 Tauri 集成时替换为本地文件系统操作。
 */

import type { ImageImportRequest, ImageImportResponse } from '../types'

/** 支持的图片格式 */
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
/** 最大文件大小 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * 校验上传文件是否合法
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `不支持的图片格式: ${file.type}，仅支持 PNG/JPEG/WebP/GIF` }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `文件大小超过限制 (最大 ${MAX_FILE_SIZE / 1024 / 1024}MB)` }
  }
  return { valid: true }
}

/**
 * 将 File 对象转换为 Base64 字符串
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 移除 data:xxx;base64, 前缀
      const base64 = result.split(',')[1] ?? result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 本地图片存储 key（网页模式下使用 localStorage 模拟本地文件存储） */
const LOCAL_IMAGE_STORE_KEY = 'companionpet_imported_images'

function getStoredImages(): Record<string, string> {
  try {
    const data = localStorage.getItem(LOCAL_IMAGE_STORE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function saveStoredImages(images: Record<string, string>): void {
  localStorage.setItem(LOCAL_IMAGE_STORE_KEY, JSON.stringify(images))
}

/**
 * 将图片导入本地存储（标准 API 接口）
 *
 * @param request - 导入请求参数
 * @returns 导入结果
 *
 * 当前实现：将图片存储到 localStorage 作为本地模拟。
 * 后续 Tauri 集成时，替换为 Rust 后端本地文件操作：
 *   - 使用 @tauri-apps/api 调用 Rust Command
 *   - 将图片写入本地 ~/.companion/pets/ 目录
 *   - 同时在 images/pets/ 下创建副本供 UI 引用
 */
export async function importImage(request: ImageImportRequest): Promise<ImageImportResponse> {
  try {
    const store = getStoredImages()
    const key = `${request.type}/${request.fileName}`
    store[key] = request.data
    saveStoredImages(store)

    return {
      success: true,
      filePath: `images/${request.type}s/${request.fileName}`,
      fileName: request.fileName,
    }
  } catch (error) {
    return {
      success: false,
      filePath: '',
      fileName: request.fileName,
      error: error instanceof Error ? error.message : '图片导入失败',
    }
  }
}

/**
 * 从用户选择的本地文件导入宠物图片
 *
 * @param file - 用户选择的本地图片文件
 * @returns 导入结果
 */
export async function importPetImage(file: File): Promise<ImageImportResponse> {
  const validation = validateImageFile(file)
  if (!validation.valid) {
    return { success: false, filePath: '', fileName: file.name, error: validation.error }
  }

  const base64 = await fileToBase64(file)
  return importImage({
    fileName: file.name,
    data: base64,
    type: 'pet',
  })
}

/**
 * 获取用户已导入的自定义宠物图片列表
 *
 * @returns 图片文件名列表
 */
export function getImportedPetImages(): string[] {
  const store = getStoredImages()
  return Object.keys(store)
    .filter((key) => key.startsWith('pet/'))
    .map((key) => key.replace('pet/', ''))
}

/**
 * 获取已导入图片的 Base64 数据
 *
 * @param fileName - 文件名
 * @param type - 图片类型
 * @returns Base64 数据或 null
 */
export function getImportedImage(fileName: string, type: 'pet' | 'icon'): string | null {
  const store = getStoredImages()
  return store[`${type}/${fileName}`] ?? null
}
