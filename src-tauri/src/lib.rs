use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    App, AppHandle, Emitter, Manager, Runtime, WebviewWindow,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

// ─── Data Structures ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEntry {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,   // base64 PNG if extracted, else None
    pub category: String,
}

// Saved window position (pixels from top-left of primary monitor)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPos { pub x: i32, pub y: i32 }

// Shared state: last window position so frontend can opt-in to remember it
struct AppState {
    last_pos: Mutex<Option<WindowPos>>,
}

// ─── App Indexer ───────────────────────────────────────────────────────────────

fn get_start_menu_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(v) = std::env::var("PROGRAMDATA") {
        dirs.push(PathBuf::from(v).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }
    if let Ok(v) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(v).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }
    if let Ok(v) = std::env::var("USERPROFILE") {
        dirs.push(PathBuf::from(v).join("Desktop"));
    }
    dirs
}

fn scan_apps(dirs: &[PathBuf]) -> Vec<AppEntry> {
    let mut apps = Vec::new();
    for dir in dirs {
        if !dir.exists() { continue; }
        for entry in walkdir::WalkDir::new(dir).max_depth(5).follow_links(true)
            .into_iter().filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("lnk") { continue; }
            let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            let lower = name.to_lowercase();
            if lower.contains("uninstall") || lower.contains("readme")
                || lower.contains("help") || lower.contains("manual") { continue; }
            let category = dir.file_name().and_then(|s| s.to_str()).unwrap_or("Other").to_string();
            apps.push(AppEntry { name, path: path.to_string_lossy().to_string(), icon: None, category });
        }
    }
    let mut seen = std::collections::HashSet::new();
    apps.retain(|a| seen.insert(a.name.clone()));
    apps.sort_by(|a, b| a.name.cmp(&b.name));
    apps
}

// ─── Icon Extraction ───────────────────────────────────────────────────────────

/// Extract the icon from a .lnk file (or its target exe) as a base64 PNG.
/// Uses PowerShell + System.Drawing — available on all Windows editions.
/// Returns None on any failure so the frontend can fall back to the color avatar.
#[cfg(target_os = "windows")]
fn extract_icon_base64(lnk_path: &str) -> Option<String> {
    // PowerShell script: resolve .lnk target → extract icon → return base64 PNG
    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
try {{
    Add-Type -Assembly System.Drawing
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut('{lnk}')
    $target = $lnk.TargetPath
    if (-not $target -or -not (Test-Path $target)) {{ $target = '{lnk}' }}
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($target)
    if (-not $icon) {{ exit 1 }}
    $bmp = $icon.ToBitmap()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    [Convert]::ToBase64String($ms.ToArray())
}} catch {{ exit 1 }}
"#,
        lnk = lnk_path.replace("'", "''")
    );

    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .ok()?;

    if !out.status.success() { return None; }
    let b64 = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if b64.is_empty() { return None; }
    Some(b64)
}

#[cfg(not(target_os = "windows"))]
fn extract_icon_base64(_: &str) -> Option<String> { None }

// ─── Tauri Commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_apps() -> Result<Vec<AppEntry>, String> {
    let dirs = get_start_menu_dirs();
    Ok(scan_apps(&dirs))
}

/// Extract icon for a single app on demand (called per-item by frontend).
#[tauri::command]
async fn get_icon(path: String) -> Result<Option<String>, String> {
    Ok(extract_icon_base64(&path))
}

#[tauri::command]
async fn launch_app(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn hide_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
async fn show_window(window: WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Save the current window position to shared state.
#[tauri::command]
async fn save_window_pos(
    window: WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    *state.last_pos.lock().unwrap() = Some(WindowPos { x: pos.x, y: pos.y });
    Ok(())
}

/// Restore the last saved position, or center if none saved.
#[tauri::command]
async fn restore_window_pos(
    window: WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let pos = state.last_pos.lock().unwrap().clone();
    match pos {
        Some(p) => window.set_position(tauri::PhysicalPosition::new(p.x, p.y))
            .map_err(|e| e.to_string()),
        None => { center_window_on_screen(&window); Ok(()) }
    }
}

// ─── Window Helpers ────────────────────────────────────────────────────────────

fn setup_window_blur<R: Runtime>(window: &WebviewWindow<R>) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_SYSTEMBACKDROP_TYPE};
        use windows::Win32::Foundation::HWND;
        let hwnd = HWND(window.hwnd().unwrap().0);
        let backdrop: u32 = 3; // DWMSBT_TRANSIENTWINDOW = Acrylic
        unsafe {
            let _ = DwmSetWindowAttribute(hwnd, DWMWA_SYSTEMBACKDROP_TYPE,
                &backdrop as *const u32 as *const _, 4);
        }
    }
}

fn center_window_on_screen<R: Runtime>(window: &WebviewWindow<R>) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let s = monitor.size();
        let w = window.outer_size().unwrap_or_default();
        let x = (s.width as i32 - w.width as i32) / 2;
        let y = (s.height as i32 / 2) - (w.height as i32 / 2) - 80;
        let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
    }
}

// ─── Tray ──────────────────────────────────────────────────────────────────────

fn build_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "打开 QuickLaunch", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出",             true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("QuickLaunch")
        .menu(&menu)
        .on_menu_event(|app: &AppHandle, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(win) = app.get_webview_window("main") {
                        center_window_on_screen(&win);
                        let _ = win.show();
                        let _ = win.set_focus();
                        let _ = win.emit("reset-search", ());
                    }
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click tray icon → toggle window
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    if win.is_visible().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        center_window_on_screen(&win);
                        let _ = win.show();
                        let _ = win.set_focus();
                        let _ = win.emit("reset-search", ());
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

// ─── App Setup ─────────────────────────────────────────────────────────────────

const HOTKEY_CANDIDATES: &[(Option<Modifiers>, Code)] = &[
    (Some(Modifiers::CONTROL.union(Modifiers::SHIFT)), Code::Space),
    (Some(Modifiers::CONTROL.union(Modifiers::SHIFT)), Code::F1),
    (Some(Modifiers::CONTROL.union(Modifiers::SHIFT)), Code::KeyQ),
];

fn register_hotkey(app: &mut App) {
    let handle = app.handle().clone();
    for &(mods, key) in HOTKEY_CANDIDATES {
        let shortcut = Shortcut::new(mods, key);
        let handle_clone = handle.clone();
        let result = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
            use tauri_plugin_global_shortcut::ShortcutState;
            if event.state() != ShortcutState::Pressed { return; }
            let h = handle_clone.clone();
            tauri::async_runtime::spawn(async move {
                if let Some(win) = h.get_webview_window("main") {
                    if win.is_visible().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        center_window_on_screen(&win);
                        let _ = win.show();
                        let _ = win.set_focus();
                        let _ = win.emit("reset-search", ());
                    }
                }
            });
        });
        match result {
            Ok(_) => {
                let label = format_shortcut(mods, key);
                eprintln!("[QuickLaunch] Hotkey registered: {label}");
                let _ = handle.emit("hotkey-registered", label);
                return;
            }
            Err(e) => eprintln!("[QuickLaunch] Hotkey unavailable: {}", e),
        }
    }
    eprintln!("[QuickLaunch] No global hotkey registered.");
    let _ = handle.emit("hotkey-failed", "所有热键均被占用，请通过系统托盘图标打开启动器");
}

fn format_shortcut(mods: Option<Modifiers>, key: Code) -> String {
    let mut parts = Vec::new();
    if let Some(m) = mods {
        if m.contains(Modifiers::CONTROL) { parts.push("Ctrl"); }
        if m.contains(Modifiers::ALT)     { parts.push("Alt"); }
        if m.contains(Modifiers::SHIFT)   { parts.push("Shift"); }
        if m.contains(Modifiers::SUPER)   { parts.push("Win"); }
    }
    parts.push(match key {
        Code::Space => "Space",
        Code::F1    => "F1",
        Code::KeyQ  => "Q",
        _           => "?",
    });
    parts.join("+")
}

fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("main").unwrap();
    setup_window_blur(&window);
    center_window_on_screen(&window);
    let _ = window.hide();
    build_tray(app)?;
    register_hotkey(app);
    Ok(())
}

// ─── Entry Point ───────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .manage(AppState { last_pos: Mutex::new(None) })
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(setup)
        .invoke_handler(tauri::generate_handler![
            get_apps,
            get_icon,
            launch_app,
            hide_window,
            show_window,
            save_window_pos,
            restore_window_pos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running QuickLaunch");
}
