# QuickLaunch 开发总结

## 项目背景

uTools 是一款优秀的效率工具，但随着版本迭代变得臃肿且商业化明显（广告、会员插件）。本项目目标是用现代技术栈复刻其核心功能：**热键唤起 → 搜索应用 → 快速启动**，同时保持极致轻量。

---

## 技术决策记录

### 为什么选 Tauri 而不是 Electron

| 维度 | Tauri | Electron |
|------|-------|----------|
| 包体 | ~5MB | ~150MB |
| 内存 | ~15MB | ~100MB |
| 原生 API | Rust 直调 Win32 | Node.js 桥接 |
| 开发体验 | 前端照旧，Rust 学习曲线 | 纯 JS，上手快 |

对于一个常驻后台的启动器，Tauri 的资源占用优势是决定性的。

### 为什么放弃 Alt+Space

Windows 内核对含 Alt 的组合键有特殊处理：

- `WM_SYSKEYDOWN` → 进入系统菜单模式
- Alt 松开时发送 `WM_SYSCOMMAND/SC_KEYMENU` 给前台窗口
- 此消息优先级高于用户态 Win32 调用，无法被 `SetForegroundWindow`、`AttachThreadInput` 等完全中和

尝试过的方案全部失败：
1. `onFocusChanged` debounce → 无效（消息在用户态之前触发）
2. `keybd_event` 合成 Alt-up → 反而多一条 SC_KEYMENU
3. `AttachThreadInput` → 能短暂获焦，但 SC_KEYMENU 照样执行

**最终方案**：换用 `Ctrl+Shift+F1`（无系统含义），热键问题彻底消失。

### 热键触发两次的 Bug

`tauri-plugin-global-shortcut` 的 `on_shortcut` 回调对 `Pressed` 和 `Released` 都触发。最初代码忽略了 `event` 参数，导致：
- 按下 → `Pressed` → 窗口显示
- 松开 → `Released` → 窗口隐藏

加一行 `if event.state() != ShortcutState::Pressed { return; }` 修复。

---

## 踩坑记录

| 坑 | 现象 | 解决 |
|----|------|------|
| `emit` 找不到 | 编译错误 | 补 `use tauri::Emitter` trait |
| 热键冲突崩溃 | `panic: HotKey already registered` | 改为遍历候选列表，失败则降级 |
| 事件监听被拒绝 | `event.listen not allowed` | 新建 `capabilities/default.json` 声明权限 |
| 圆角外方形遮罩 | 窗口圆角但有方形阴影区域 | 给 `html/body/#root` 加相同 `border-radius` |
| 拖拽与点击冲突 | 点击触发拖拽，拖拽后触发点击 | 改为「编辑模式」统一管理，非编辑模式禁用 draggable |
| `AttachThreadInput` 路径错误 | 连续编译报错 | 正确模块路径是 `Win32::System::Threading` |

---

## 架构演进

```
v0.1  基础框架：热键 + 扫描 + 搜索列表
  ↓
v0.2  修复 Alt 焦点问题 → 换热键
  ↓
v0.3  修复 Pressed/Released 双触发
  ↓
v0.4  加入 Pin 主页 + 失焦关闭
  ↓
v0.5  Pin 编辑模式 + 右键菜单 + 缩写搜索 + 圆角修复（当前）
```

---

## 后续优化方向（见 README 路线图）

性能方面优先级最高的是**应用图标提取**（当前用色块代替），其次是**使用频率记录**（让最常用的应用排在前面）。这两项对日常使用体验提升最大。
