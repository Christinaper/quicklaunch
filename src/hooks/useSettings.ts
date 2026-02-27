import { useState, useCallback, useEffect } from "react";

export type Language = "zh" | "en";

export interface Settings {
  language: Language;
  autoStart: boolean;
  minimizeToTray: boolean;
  autoHideOnBlur: boolean;
  rememberPosition: boolean;   // false = always restore to center
  hotkey: string;              // display only; actual binding is in Rust
}

export const DEFAULT_SETTINGS: Settings = {
  language: "zh",
  autoStart: false,
  minimizeToTray: true,
  autoHideOnBlur: true,
  rememberPosition: false,
  hotkey: "Ctrl+Shift+Space",
};

const KEY = "quicklaunch:settings";

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);
  const [dirty, setDirty]       = useState(false);
  const [saved, setSaved]       = useState(false);

  // Sync changes from outside (e.g. hotkey-registered event)
  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
    setDirty(true);
    setSaved(false);
  }, []);

  const save = useCallback(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings]);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setDirty(true);
    setSaved(false);
  }, []);

  return { settings, patchSettings, save, reset, dirty, saved };
}

// ── i18n strings ──────────────────────────────────────────────────────────────
export const T = {
  zh: {
    pinned: "已固定", edit: "编辑", done: "完成",
    searchPlaceholder: "输入关键词搜索应用...",
    searchingPlaceholder: "搜索应用...",
    navigate: "导航", open: "打开", pin: "固定", close: "关闭", back: "返回",
    emptyPin: "还没有 Pin", emptyPinHint: "搜索应用后，点击 ★ 将其固定到这里",
    dragSort: "拖拽排序中...",
    pinTipEdit: "拖拽排序 · 右键重命名或取消固定 · 点击「完成」退出",
    pinTipNormal: "右键卡片可重命名或取消固定",
    rename: "重命名", unpin: "取消固定",
    settings: "设置",
    settingsTitle: "通用设置",
    langLabel: "语言",
    startupLabel: "启动",
    autoStart: "开机自动启动",
    minimizeToTray: "最小化到系统托盘",
    windowLabel: "窗口行为",
    autoHide: "失焦时自动隐藏",
    rememberPos: "记住窗口位置（关闭则每次居中）",
    hotkeyLabel: "快捷键",
    hotkeyHint: "当前快捷键由系统自动选择，支持 Ctrl+Shift+Space / Ctrl+Shift+F1",
    aboutLabel: "关于",
    version: "版本",
    updateStatus: "更新状态",
    upToDate: "已是最新版本",
    checkUpdate: "检查更新",
    saveBtn: "保存更改",
    savedMsg: "✓ 已保存",
    resetBtn: "恢复默认",
    nPinned: (n: number) => `${n} 个已固定`,
    typeToSearch: "输入开始搜索",
  },
  en: {
    pinned: "Pinned", edit: "Edit", done: "Done",
    searchPlaceholder: "Search apps...",
    searchingPlaceholder: "Search apps...",
    navigate: "Navigate", open: "Open", pin: "Pin", close: "Close", back: "Back",
    emptyPin: "No pins yet", emptyPinHint: "Search an app and click ★ to pin it here",
    dragSort: "Dragging...",
    pinTipEdit: "Drag to reorder · Right-click to rename or unpin · Click Done",
    pinTipNormal: "Right-click to rename or unpin",
    rename: "Rename", unpin: "Unpin",
    settings: "Settings",
    settingsTitle: "General Settings",
    langLabel: "Language",
    startupLabel: "Startup",
    autoStart: "Launch at login",
    minimizeToTray: "Minimize to system tray",
    windowLabel: "Window Behavior",
    autoHide: "Auto-hide when focus is lost",
    rememberPos: "Remember window position (off = always center)",
    hotkeyLabel: "Hotkey",
    hotkeyHint: "Current hotkey is auto-selected. Supports Ctrl+Shift+Space / Ctrl+Shift+F1",
    aboutLabel: "About",
    version: "Version",
    updateStatus: "Update status",
    upToDate: "Up to date",
    checkUpdate: "Check for updates",
    saveBtn: "Save Changes",
    savedMsg: "✓ Saved",
    resetBtn: "Reset Defaults",
    nPinned: (n: number) => `${n} pinned`,
    typeToSearch: "Type to search",
  },
} as const;

export type Strings = typeof T["zh"];
