# QuickLaunch 优化指南

## 一、当前性能瓶颈分析

### 1. 启动延迟（首次扫描）
**问题**：冷启动时 Rust 扫描 Start Menu 是同步阻塞的，应用列表大时前端 loading 时间长。

**优化方案**：
```rust
// 当前：启动时全量扫描
fn get_apps() → Vec<AppEntry>

// 优化：启动时读缓存，后台异步更新
fn setup(app) {
    // 1. 立即读本地缓存 JSON → 前端瞬间可用
    let cached = read_cache();
    window.emit("apps-ready", cached);

    // 2. 后台线程重新扫描
    tauri::async_runtime::spawn(async {
        let fresh = scan_apps();
        write_cache(fresh);
        window.emit("apps-updated", fresh);
    });
}
```
**效果**：冷启动从 ~300ms → 瞬间可用，后台静默更新。

---

### 2. 搜索响应（大量应用时）
**问题**：每次输入都对全量应用列表跑 Fuse.js + 自定义打分，1000+ 应用时可能有感知延迟。

**优化方案**：加 `useDeferredValue` 防抖
```typescript
// src/hooks/useApps.ts
import { useDeferredValue } from "react";

// 在 App.tsx 里
const deferredQuery = useDeferredValue(query);
useEffect(() => { search(deferredQuery); }, [deferredQuery]);
```
**效果**：输入不卡，搜索结果稍有延迟但不阻塞打字。

---

### 3. 应用图标（当前用色块）
**问题**：色块不直观，真实图标可大幅提升辨识度。

**优化方案**：用 PowerShell 提取 .lnk 目标 exe 的图标

```rust
// 新增 Tauri command
#[tauri::command]
async fn get_app_icon(path: String) -> Result<String, String> {
    // 调用 PowerShell 提取图标为 base64 PNG
    let output = std::process::Command::new("powershell")
        .args(["-Command", &format!(
            r#"Add-Type -Assembly System.Drawing;
               $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('{}');
               $bmp = $icon.ToBitmap();
               $ms = New-Object System.IO.MemoryStream;
               $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
               [Convert]::ToBase64String($ms.ToArray())"#, path
        )])
        .output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
```

前端收到 base64 后缓存到 `localStorage`，避免重复提取。

---

### 4. 动画流畅度
**问题**：窗口显示/隐藏无动画，体验偏生硬。

**优化方案**：Tauri 不支持窗口级动画，改在 CSS 层做：

```css
/* 显示时已有 fadeIn，隐藏前加 fadeOut */
.launcher.hiding {
  animation: fadeOut 0.1s ease forwards;
}

@keyframes fadeOut {
  to { opacity: 0; transform: translateY(-6px) scale(0.98); }
}
```

```typescript
// App.tsx：隐藏前先播动画
const hideWithAnimation = () => {
  document.querySelector('.launcher')?.classList.add('hiding');
  setTimeout(() => invoke("hide_window"), 100);
};
```

---

## 二、功能扩展路线图（优先级排序）

### 🥇 高优先级（影响日常使用）

#### 1. 使用频率排序
记录每次启动的应用和时间，Pin 主页默认显示最近/最常用：

```typescript
// src/hooks/useFrequency.ts
interface FreqRecord { path: string; count: number; lastUsed: number; }

function recordLaunch(path: string) {
  const records: FreqRecord[] = JSON.parse(localStorage.getItem('freq') ?? '[]');
  const existing = records.find(r => r.path === path);
  if (existing) { existing.count++; existing.lastUsed = Date.now(); }
  else records.push({ path, count: 1, lastUsed: Date.now() });
  localStorage.setItem('freq', JSON.stringify(records));
}
```

#### 2. 自定义热键
在托盘右键菜单里加「设置」，支持修改热键：

```rust
// lib.rs：动态注册热键
#[tauri::command]
async fn set_hotkey(app: AppHandle, new_key: String) -> Result<(), String> {
    // 注销旧热键，注册新热键
    // 写入 config.json 持久化
}
```

---

### 🥈 中优先级（体验提升）

#### 3. 内联计算器
搜索框输入数学表达式时直接显示结果：

```typescript
// 在 search() 前加判断
import * as math from 'mathjs';

const calcResult = tryCalculate(query);
if (calcResult !== null) {
  setResults([{ name: `= ${calcResult}`, path: '__calc__', ... }]);
  return;
}
```

#### 4. 系统命令
内置关机、重启、锁屏等操作：

```typescript
const SYSTEM_COMMANDS = [
  { name: '锁定屏幕', keywords: ['lock', '锁屏'], cmd: 'rundll32 user32.dll,LockWorkStation' },
  { name: '关机',     keywords: ['shutdown', '关机'], cmd: 'shutdown /s /t 0' },
  { name: '重启',     keywords: ['restart', '重启'], cmd: 'shutdown /r /t 0' },
];
```

---

### 🥉 低优先级（锦上添花）

#### 5. Everything 文件搜索集成
调用 Everything SDK 的 HTTP API（Everything 需在后台运行）：

```typescript
const res = await fetch(`http://localhost:8080/?s=${query}&json=1&count=5`);
const files = await res.json();
```

#### 6. 剪贴板历史
记录最近 20 条剪贴板内容，快速粘贴：

```rust
// 用 tauri-plugin-clipboard-manager 读取剪贴板
// 定时轮询（每秒）检测变化
```

---

## 三、代码质量提升

### 单元测试
```typescript
// src/hooks/useApps.test.ts
import { getInitials, initialsMatch } from './useApps';

test('initials match', () => {
  expect(initialsMatch('Visual Studio Code', 'vsc')).toBe(true);
  expect(initialsMatch('Visual Studio Code', 'vs')).toBe(true);
  expect(initialsMatch('Google Chrome', 'gc')).toBe(true);
});
```

### 错误边界
```tsx
// src/components/ErrorBoundary.tsx
// 包裹整个 App，防止单个组件崩溃导致白屏
```

---

## 四、发布打包

```powershell
# 构建生产版本
npm run tauri build

# 输出在：
# src-tauri/target/release/bundle/
#   msi/quicklaunch_0.1.0_x64_en-US.msi   ← Windows 安装包
#   nsis/quicklaunch_0.1.0_x64-setup.exe  ← 单文件安装程序
```

建议发布 `.exe` 格式（NSIS），用户直接双击安装，无需额外依赖。

