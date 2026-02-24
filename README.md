# ⚡ QuickLaunch

> 轻量、快速、无广告的 Windows 11 应用启动器 — uTools 的简洁替代品

![Platform](https://img.shields.io/badge/platform-Windows%2011-0078D4?logo=windows)
![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📸 功能预览

```
Alt + Space  →  唤出搜索框（窗口正上方，毛玻璃效果）
  输入关键词  →  模糊搜索本地所有应用
  ↑ ↓ 导航   →  键盘选择
  Enter 打开  →  启动应用并自动隐藏
  Esc / 失焦  →  窗口自动隐藏
```

---

## ✨ 特性

| 特性 | 说明 |
|------|------|
| 🚀 **极速启动** | Rust 后端秒级扫描 Start Menu 全量应用 |
| 🔍 **模糊搜索** | 基于 Fuse.js，支持拼写容错 |
| 🪟 **Win11 风格** | Acrylic 毛玻璃 + 无边框窗口 |
| ⌨️ **全局热键** | `Alt + Space` 随时唤出 |
| 👻 **自动隐藏** | 失焦即隐藏，不占用任务栏 |
| 🪶 **极轻量** | 包体 ~5MB，内存 ~15MB |
| 🚫 **零广告** | 无遥测、无弹窗、无商业化 |

---

## 🏗️ 技术架构

```
quicklaunch/
├── src-tauri/              # Rust 后端 (Tauri 2.x)
│   ├── src/
│   │   ├── main.rs         # 程序入口
│   │   └── lib.rs          # 核心逻辑
│   │       ├── scan_apps() # 扫描 Start Menu / Desktop
│   │       ├── get_apps    # IPC 命令：返回应用列表
│   │       ├── launch_app  # IPC 命令：启动应用
│   │       └── hide_window # IPC 命令：隐藏窗口
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json     # 窗口配置（无边框、透明、置顶）
│
├── src/                    # React 前端
│   ├── components/
│   │   ├── SearchBar.tsx   # 搜索输入框
│   │   ├── ResultList.tsx  # 结果列表 + 高亮
│   │   ├── AppIcon.tsx     # 应用图标（名称生成）
│   │   └── Footer.tsx      # 底部快捷键提示
│   ├── hooks/
│   │   ├── useApps.ts      # 应用数据 + Fuse.js 搜索
│   │   └── useKeyboard.ts  # 键盘导航
│   ├── styles/
│   │   ├── global.css      # 全局样式 / 动画
│   │   └── app.css         # 毛玻璃 UI 样式
│   ├── App.tsx             # 主组件（失焦隐藏、热键响应）
│   └── main.tsx            # React 入口
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

### 数据流

```
[全局热键 Alt+Space]
       │
       ▼
  Rust 热键监听 ──► emit("reset-search") ──► React 重置搜索框
       │
       ▼
  window.show() + set_focus()
       │
       ▼
  用户输入 ──► Fuse.js 模糊搜索 (前端)
       │
       ▼
  按 Enter ──► invoke("launch_app") ──► Rust cmd /C start ""
                                   ──► invoke("hide_window")
```

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本 | 安装 |
|------|------|------|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| Rust | stable | [rustup.rs](https://rustup.rs) |
| Visual Studio Build Tools | 2022 | MSVC + Windows SDK |
| WebView2 Runtime | 最新 | Win11 已内置 |

### 安装 Rust（Windows）

```powershell
# 安装 rustup
winget install Rustlang.Rustup

# 验证
rustc --version   # rustc 1.xx.x
cargo --version   # cargo 1.xx.x
```

### 安装 VS Build Tools

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
# 安装时勾选：Desktop development with C++
```

### 克隆并运行

```bash
# 克隆项目
git clone https://github.com/yourname/quicklaunch.git
cd quicklaunch

# 安装前端依赖
npm install

# 开发模式运行（热重载）
npm run tauri dev

# 生产构建
npm run tauri build
```

> 构建产物在 `src-tauri/target/release/bundle/` 目录

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + Space` | 唤出 / 隐藏启动器 |
| `↑` `↓` | 上下选择应用 |
| `Tab` / `Shift+Tab` | 同上下方向键 |
| `Enter` | 打开选中的应用 |
| `Esc` | 隐藏启动器 |

---

## 🔍 搜索说明

搜索引擎基于 **[Fuse.js](https://www.fusejs.io/)** 实现模糊匹配：

- **搜索范围**：应用名称 + 分类文件夹名
- **容错能力**：支持拼写错误（threshold = 0.35）
- **结果数量**：最多显示 8 条，按相关度排序
- **响应速度**：< 5ms（纯前端，无网络请求）

示例：
```
输入 "chro"   → 匹配 "Google Chrome"
输入 "vscode" → 匹配 "Visual Studio Code"
输入 "微信"   → 匹配 "WeChat"
```

---

## 🪟 窗口配置说明

`tauri.conf.json` 关键配置：

```json
{
  "decorations": false,    // 无标题栏/边框
  "transparent": true,     // 背景透明（配合毛玻璃）
  "alwaysOnTop": true,     // 始终置顶
  "skipTaskbar": true,     // 不显示在任务栏
  "visible": false         // 初始隐藏，由热键显示
}
```

Win11 Acrylic 效果通过 `DwmSetWindowAttribute` 系统 API 实现（见 `lib.rs`）。

---

## 🗂️ 应用索引路径

启动时自动扫描以下目录（.lnk 快捷方式）：

```
C:\ProgramData\Microsoft\Windows\Start Menu\Programs\   ← 系统应用
%APPDATA%\Microsoft\Windows\Start Menu\Programs\        ← 用户安装的应用  
%USERPROFILE%\Desktop\                                  ← 桌面快捷方式
```

**自动过滤**：包含 `uninstall` / `readme` / `help` / `manual` 的快捷方式会被忽略。

---

## 🔮 路线图

- [ ] **自定义热键** — 支持在设置中修改快捷键
- [ ] **文件搜索** — 集成 Everything SDK 实现全盘文件搜索
- [ ] **计算器** — 内联计算，输入 `2+2` 直接显示结果
- [ ] **应用图标** — 从 .lnk 提取真实 exe 图标
- [ ] **使用频率排序** — 记录并优先显示常用应用
- [ ] **主题切换** — 浅色 / 深色 / 跟随系统
- [ ] **系统命令** — 支持 `lock`、`shutdown`、`restart` 等

---

## 🤝 贡献

欢迎 PR 和 Issue！

```bash
# 开发调试
npm run tauri dev

# 前端单独调试（Mock 数据）
npm run dev
```

代码风格：Rust 使用 `rustfmt`，TypeScript 使用 `prettier`。

---

## 📄 许可证

[MIT License](LICENSE) — 自由使用、修改、分发。

---

<div align="center">
  <sub>Made with ❤️ as a lightweight alternative to uTools</sub>
</div>
