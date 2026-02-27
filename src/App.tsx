import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { SearchBar }     from "./components/SearchBar";
import { ResultList }    from "./components/ResultList";
import { PinBoard }      from "./components/PinBoard";
import { Footer }        from "./components/Footer";
import { SettingsPanel } from "./components/SettingsPanel";
import { useApps }       from "./hooks/useApps";
import { useKeyboard }   from "./hooks/useKeyboard";
import { usePins }       from "./hooks/usePins";
import { useSettings, T } from "./hooks/useSettings";
import type { AppEntry } from "./hooks/useApps";
import "./styles/app.css";

const appWindow = getCurrentWebviewWindow();

export default function App() {
  const [query,         setQuery]         = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hotkey,        setHotkey]        = useState("Ctrl+Shift+F1");
  const [hotkeyWarning, setHotkeyWarning] = useState<string | null>(null);
  const [showSettings,  setShowSettings]  = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { results, loading, search, launch: launchApp }              = useApps();
  const { pins, addPin, removePin, renamePin, reorderPins, isPinned } = usePins();
  const { settings, patchSettings, save, reset, dirty, saved }       = useSettings();

  const t    = T[settings.language];
  const mode: "pins" | "search" = query.trim() ? "search" : "pins";
  const activeList = mode === "search" ? results : pins.map(p => p.app);

  // ── Hotkey events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unOk  = listen<string>("hotkey-registered", e => {
      setHotkey(e.payload);
      patchSettings({ hotkey: e.payload });
    });
    const unErr = listen<string>("hotkey-failed", e => setHotkeyWarning(e.payload));
    return () => { unOk.then(f => f()); unErr.then(f => f()); };
  }, [patchSettings]);

  // On summon: reset UI; restore or center window based on setting
  useEffect(() => {
    const un = listen("reset-search", async () => {
      setQuery(""); setSelectedIndex(0); setShowSettings(false);
      if (settings.rememberPosition) {
        await invoke("restore_window_pos").catch(() => {});
      }
    });
    return () => { un.then(f => f()); };
  }, [settings.rememberPosition]);

  // ── Blur → hide ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        if (blurTimer.current) { clearTimeout(blurTimer.current); blurTimer.current = null; }
      } else if (settings.autoHideOnBlur) {
        blurTimer.current = setTimeout(async () => {
          // Save position before hiding if rememberPosition is on
          if (settings.rememberPosition) {
            await invoke("save_window_pos").catch(() => {});
          }
          invoke("hide_window");
        }, 150);
      }
    });
    return () => { unlisten.then(f => f()); if (blurTimer.current) clearTimeout(blurTimer.current); };
  }, [settings.autoHideOnBlur, settings.rememberPosition]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSearch = useCallback((val: string) => {
    setQuery(val); setSelectedIndex(0); search(val);
  }, [search]);

  const handleLaunchApp = useCallback(async (app: AppEntry) => {
    await launchApp(app); setQuery(""); setSelectedIndex(0);
  }, [launchApp]);

  const handleLaunchPin = useCallback(async (pin: import("./hooks/usePins").PinItem) => {
    await launchApp(pin.app); setQuery(""); setSelectedIndex(0);
  }, [launchApp]);

  const handleSelect  = useCallback((i: number) => setSelectedIndex(i), []);

  const handleConfirm = useCallback((i: number) => {
    if (mode === "search" && results[i]) handleLaunchApp(results[i]);
    else if (mode === "pins" && pins[i]) handleLaunchPin(pins[i]);
  }, [mode, results, pins, handleLaunchApp, handleLaunchPin]);

  const handleEscape = useCallback(() => {
    if (showSettings) { setShowSettings(false); return; }
    if (query)        { setQuery(""); setSelectedIndex(0); return; }
    invoke("hide_window");
  }, [query, showSettings]);

  const handlePinToggle = useCallback((app: AppEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned(app.path)) {
      const p = pins.find(x => x.app.path === app.path);
      if (p) removePin(p.id);
    } else addPin(app);
  }, [isPinned, pins, removePin, addPin]);

  // Window drag: mousedown on drag area calls Tauri startDragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;            // left button only
    e.preventDefault();
    appWindow.startDragging().catch(() => {});
  }, []);

  useKeyboard({
    resultsLength: showSettings ? 0 : activeList.length,
    selectedIndex, onSelect: handleSelect, onConfirm: handleConfirm, onEscape: handleEscape,
  });

  return (
    <div className="launcher">
      <div className="launcher-inner">
        {hotkeyWarning && <div className="hotkey-warning">⚠️ {hotkeyWarning}</div>}

        {showSettings ? (
          <SettingsPanel
            settings={settings} onPatch={patchSettings} onSave={save}
            onReset={reset} onClose={() => setShowSettings(false)}
            dirty={dirty} saved={saved} hotkey={hotkey} t={t}
          />
        ) : (
          <>
            {/* Drag handle strip at the top */}
            <div className="drag-strip" onMouseDown={handleDragStart} />

            <div className="search-row">
              <SearchBar
                value={query} onChange={handleSearch} loading={loading}
                resultCount={mode === "search" ? results.length : pins.length}
                mode={mode} t={t}
              />
              <button className="icon-btn settings-btn" onClick={() => setShowSettings(true)} title={t.settings}>
                <svg viewBox="0 0 16 16" fill="currentColor" width="15" height="15">
                  <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                  <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
                </svg>
              </button>
              <button className="icon-btn close-btn" onClick={() => invoke("hide_window")} title={t.close}>✕</button>
            </div>

            <div className="content-area">
              {mode === "pins"
                ? <PinBoard pins={pins} onLaunch={handleLaunchPin} onRemove={removePin}
                    onRename={renamePin} onReorder={reorderPins}
                    selectedIndex={selectedIndex} onSelect={handleSelect} t={t} />
                : !loading && <ResultList results={results} selectedIndex={selectedIndex}
                    onSelect={handleSelect} onLaunch={handleLaunchApp}
                    onPinToggle={handlePinToggle} isPinned={isPinned} query={query} />
              }
            </div>

            <Footer hotkey={hotkey} mode={mode} pinCount={pins.length} t={t} />
          </>
        )}
      </div>
    </div>
  );
}

