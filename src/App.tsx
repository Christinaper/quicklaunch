import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { SearchBar } from "./components/SearchBar";
import { ResultList } from "./components/ResultList";
import { PinBoard } from "./components/PinBoard";
import { Footer } from "./components/Footer";
import { useApps } from "./hooks/useApps";
import { useKeyboard } from "./hooks/useKeyboard";
import { usePins } from "./hooks/usePins";
import type { AppEntry } from "./hooks/useApps";
import "./styles/app.css";

const appWindow = getCurrentWebviewWindow();

export default function App() {
  const [query, setQuery]                 = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hotkey, setHotkey]               = useState("Ctrl+Shift+F1");
  const [hotkeyWarning, setHotkeyWarning] = useState<string | null>(null);
  const blurTimer                         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { results, loading, search, launch: launchApp } = useApps();
  const { pins, addPin, removePin, renamePin, reorderPins, isPinned } = usePins();

  const mode: "pins" | "search" = query.trim() ? "search" : "pins";
  const activeList = mode === "search" ? results : pins.map((p) => p.app);

  // ── Hotkey events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unOk  = listen<string>("hotkey-registered", (e) => setHotkey(e.payload));
    const unErr = listen<string>("hotkey-failed",     (e) => setHotkeyWarning(e.payload));
    return () => { unOk.then((f) => f()); unErr.then((f) => f()); };
  }, []);

  // Reset to pin board every time the window is summoned via hotkey
  useEffect(() => {
    const un = listen("reset-search", () => {
      setQuery("");
      setSelectedIndex(0);
    });
    return () => { un.then((f) => f()); };
  }, []);

  // ── Blur → hide (debounced 150ms) ─────────────────────────────────────────
  // Safe now that hotkey only fires on Pressed, not Released.
  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        if (blurTimer.current) { clearTimeout(blurTimer.current); blurTimer.current = null; }
      } else {
        blurTimer.current = setTimeout(() => invoke("hide_window"), 150);
      }
    });
    return () => {
      unlisten.then((f) => f());
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    if (mode === "search" && results[i])  handleLaunchApp(results[i]);
    else if (mode === "pins" && pins[i])  handleLaunchPin(pins[i]);
  }, [mode, results, pins, handleLaunchApp, handleLaunchPin]);

  const handleEscape = useCallback(() => {
    if (query) { setQuery(""); setSelectedIndex(0); }
    else invoke("hide_window");
  }, [query]);

  const handlePinToggle = useCallback((app: AppEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned(app.path)) { const p = pins.find((x) => x.app.path === app.path); if (p) removePin(p.id); }
    else addPin(app);
  }, [isPinned, pins, removePin, addPin]);

  useKeyboard({ resultsLength: activeList.length, selectedIndex, onSelect: handleSelect, onConfirm: handleConfirm, onEscape: handleEscape });

  return (
    <div className="launcher">
      <div className="drag-region" data-tauri-drag-region />
      <div className="launcher-inner">
        {hotkeyWarning && <div className="hotkey-warning">⚠️ {hotkeyWarning}</div>}

        <div className="search-row">
          <SearchBar value={query} onChange={handleSearch} loading={loading}
            resultCount={mode === "search" ? results.length : pins.length} mode={mode} />
          <button className="close-btn" onClick={() => invoke("hide_window")} title="关闭 (Esc)">
            ✕
          </button>
        </div>

        <div className="content-area">
          {mode === "pins"
            ? <PinBoard pins={pins} onLaunch={handleLaunchPin} onRemove={removePin}
                onRename={renamePin} onReorder={reorderPins}
                selectedIndex={selectedIndex} onSelect={handleSelect} />
            : !loading && <ResultList results={results} selectedIndex={selectedIndex}
                onSelect={handleSelect} onLaunch={handleLaunchApp}
                onPinToggle={handlePinToggle} isPinned={isPinned} query={query} />
          }
        </div>

        <Footer hotkey={hotkey} mode={mode} pinCount={pins.length} />
      </div>
    </div>
  );
}