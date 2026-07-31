<p align="center">
  <img src="https://github.com/JayeGT002/CompanionPet-NEXT/blob/main/public/images/icons/app-icon.png?raw=true" width="120" alt="伴星 CompanionPet">
</p>

<h1 align="center">伴星 CompanionPet</h1>

<p align="center">
  跨平台桌面宠物 — 常驻屏幕角落的陪伴者
</p>

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License">
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri&style=flat-square" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&style=flat-square" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&style=flat-square" alt="TypeScript">
  <img src="https://img.shields.io/badge/Rust-1.x-000000?logo=rust&style=flat-square" alt="Rust">
</p>

<p align="center">
  <a href="#功能">功能</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#开源协议">开源协议</a> •
  <a href="#声明">声明</a>
</p>

---

## 简介

伴星（CompanionPet）是一款基于 **Tauri 2 + React + TypeScript** 开发的跨平台桌面宠物应用。常驻于屏幕角落，通过气泡对话与用户进行轻量级陪伴交互。

## 功能

- 🐱 **桌面宠物常驻** — 单张 PNG 渲染，支持自由拖拽摆放
- 💬 **气泡对话系统** — 一言 API 随机陪伴，进程监听情境化反馈
- 🚀 **开机自启动** — 登录即陪伴，静默启动无打扰

## 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 桌面框架 | **Tauri 2.x** | 跨平台原生窗口，Rust 后端 |
| 前端 UI | **React 19 + TypeScript** | 组件化开发，类型安全 |
| 构建工具 | **Vite** | 极速 HMR，高效打包 |
| 进程监听 | **sysinfo (Rust)** | 跨平台应用感知 |
| 数据存储 | **SQLite (rusqlite)** | 本地持久化，零外部依赖 |

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/JayeGT002/CompanionPet-NEXT.git
cd CompanionPet-NEXT

# 安装依赖
npm install

# 开发模式（热重载）
npm run tauri dev

# 构建生产版本
npm run tauri build
```

### 平台支持

| 平台 | 架构 | 状态 |
|---|---|---|
| macOS | Apple Silicon (arm64) | ✅ 支持 |
| Windows | x64 | ✅ 支持 |

## 开源协议声明

伴星 CompanionPet 遵循 [MIT License](LICENSE) 协议开源。

## 版权声明

本项目中的美术资源（包括但不限于角色立绘、图标、表情等）均收集自互联网，**版权归原作者所有**。
- public/images/pets 目录下资源来自《洛克王国：世界》创作者资源库，版权归属腾讯公司以及魔方工作室。
- public/images/icons 目录下资源来自阿里巴巴矢量图标库，版权归属原作者。

若您是相关资源的版权所有者且不希望本项目中使用您的作品，请通过 [Issue](https://github.com/JayeGT002/CompanionPet-NEXT/issues) 联系我们，我们将立即移除。
