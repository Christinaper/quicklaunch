use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{App, Emitter, Manager, Runtime, WebviewWindow};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

// ─── Data Structures ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEntry {
    pub name: String,
    pub path: String,
    pub icon: Option<String>,
    pub category: String,
}

// ─── App Indexer ───────────────────────────────────────────────────────────────

fn get_start_menu_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // System-wide Start Menu
    if let Ok(programdata) = std::env::var("PROGRAMDATA") {
        dirs.push(PathBuf::from(programdata).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }

    // User Start Menu
    if let Ok(appdata) = std::env::var("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }

    // Desktop shortcuts (user)
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        dirs.push(PathBuf::from(userprofile).join("Desktop"));
    }

    dirs
}

fn scan_apps(dirs: &[PathBuf]) -> Vec<AppEntry> {
    let mut apps = Vec::new();

    for dir in dirs {
        if !dir.exists() {
            continue;
        }

        let walker = walkdir::WalkDir::new(dir)
            .max_depth(5)
            .follow_links(true);

        for entry in walker.into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();

            // Only process .lnk shortcut files
            if path.extension().and_then(|e| e.to_str()) != Some("lnk") {
                continue;
            }

            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            // Filter out uninstall / help shortcuts
            let lower = name.to_lowercase();
            if lower.contains("uninstall")
                || lower.contains("readme")
                || lower.contains("help")
                || lower.contains("manual")
            {
                continue;
            }

            let category = dir
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("Other")
                .to_string();

            apps.push(AppEntry {
                name,
                path: path.to_string_lossy().to_string(),
                icon: None, // Icon extraction handled on frontend via Tauri shell
                category,
            });
        }
    }

    // Deduplicate by name (keep first occurrence)
    let mut seen = std::collections::HashSet::new();
    apps.retain(|app| seen.insert(app.name.clone()));

    apps.sort_by(|a, b| a.name.cmp(&b.name));
    apps
}

// ─── Tauri Commands ────────────────────────────────────────────────────────────

#[tauri::command]
async fn get_apps() -> Result<Vec<AppEntry>, String> {
    let dirs = get_start_menu_dirs();
    let apps = scan_apps(&dirs);
    Ok(apps)
}

#[tauri::command]
async fn launch_app(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Only supported on Windows".to_string());
    }
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

// ─── Window Helpers ────────────────────────────────────────────────────────────

fn setup_window_blur<R: Runtime>(window: &WebviewWindow<R>) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_SYSTEMBACKDROP_TYPE};
        use windows::Win32::Foundation::HWND;

        let hwnd = window.hwnd().unwrap();
        let hwnd = HWND(hwnd.0);

        // DWMSBT_MAINWINDOW = 2 (Mica), DWMSBT_TRANSIENTWINDOW = 3 (Acrylic)
        let backdrop: u32 = 3; // Acrylic
        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_SYSTEMBACKDROP_TYPE,
                &backdrop as *const u32 as *const _,
                std::mem::size_of::<u32>() as u32,
            );
        }
    }
}


fn center_window_on_screen<R: Runtime>(window: &WebviewWindow<R>) {
    if let Ok(monitor) = window.current_monitor() {
        if let Some(monitor) = monitor {
            let screen_size = monitor.size();
            let window_size = window.outer_size().unwrap_or_default();

            let x = (screen_size.width as i32 - window_size.width as i32) / 2;
            let y = (screen_size.height as i32 / 2) - (window_size.height as i32 / 2) - 80;

            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        }
    }
}

// ─── App Setup ─────────────────────────────────────────────────────────────────

// ANY hotkey containing Alt triggers WM_SYSCOMMAND/SC_KEYMENU on key-up,
// which causes Windows to forcibly steal focus back from our window.
// This is a kernel-level behaviour that cannot be overridden from user space.
// Solution: use only Ctrl+Shift combinations which have no system meaning.
const HOTKEY_CANDIDATES: &[(Option<Modifiers>, Code)] = &[
    (Some(Modifiers::CONTROL.union(Modifiers::SHIFT)), Code::Space),  // Ctrl+Shift+Space
    (Some(Modifiers::CONTROL.union(Modifiers::SHIFT)), Code::F1),     // Ctrl+Shift+F1
    (Some(Modifiers::CONTROL.union(Modifiers::SHIFT)), Code::KeyQ),   // Ctrl+Shift+Q
];

fn register_hotkey(app: &mut App) {
    let handle = app.handle().clone();

    for &(mods, key) in HOTKEY_CANDIDATES {
        let shortcut = Shortcut::new(mods, key);
        let handle_clone = handle.clone();

        let result = app.global_shortcut().on_shortcut(
            shortcut,
            move |_app, _shortcut, event| {
                // Only act on key-DOWN. The plugin fires for both Pressed and
                // Released; without this guard the window toggles twice per
                // keystroke: once on press (show) and once on release (hide).
                use tauri_plugin_global_shortcut::ShortcutState;
                if event.state() != ShortcutState::Pressed {
                    return;
                }

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
            },
        );

        match result {
            Ok(_) => {
                let label = format_shortcut(mods, key);
                eprintln!("[QuickLaunch] Hotkey registered: {label}");
                let _ = handle.emit("hotkey-registered", label);
                return;
            }
            Err(e) => {
                eprintln!("[QuickLaunch] Hotkey {:?}+{:?} unavailable: {}", mods, key, e);
            }
        }
    }

    eprintln!("[QuickLaunch] Warning: no global hotkey registered. Use the tray icon.");
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

    // Apply Win11 Acrylic blur
    setup_window_blur(&window);

    // Center window vertically above center
    center_window_on_screen(&window);

    // Hide initially — shown only via hotkey or tray
    let _ = window.hide();

    // Try to register a global hotkey (graceful fallback, never panics)
    register_hotkey(app);

    Ok(())
}

// ─── Entry Point ───────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(setup)
        .invoke_handler(tauri::generate_handler![
            get_apps,
            launch_app,
            hide_window,
            show_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running QuickLaunch");
}