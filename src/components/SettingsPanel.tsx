import React, { useState } from "react";
import type { Settings, Strings } from "../hooks/useSettings";

interface SettingsPanelProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
  dirty: boolean;
  saved: boolean;
  hotkey: string;       // actual registered hotkey from Rust
  t: Strings;
}

const VERSION = "0.1.0";

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings, onPatch, onSave, onReset, onClose, dirty, saved, hotkey, t,
}) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg]           = useState<string | null>(null);

  const fakeCheckUpdate = () => {
    setCheckingUpdate(true);
    setUpdateMsg(null);
    setTimeout(() => {
      setCheckingUpdate(false);
      setUpdateMsg(t.upToDate);
    }, 1200);
  };

  return (
    <div className="settings-panel">
      {/* Header */}
      <div className="settings-header">
        <span className="settings-title">{t.settingsTitle}</span>
        <button className="settings-close" onClick={onClose} title={t.close}>✕</button>
      </div>

      <div className="settings-body">

        {/* ── Language ─────────────────────────────────────────────────── */}
        <section className="settings-section">
          <div className="settings-section-title">{t.langLabel}</div>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${settings.language === "zh" ? "active" : ""}`}
              onClick={() => onPatch({ language: "zh" })}
            >
              简体中文
            </button>
            <button
              className={`toggle-btn ${settings.language === "en" ? "active" : ""}`}
              onClick={() => onPatch({ language: "en" })}
            >
              English
            </button>
          </div>
        </section>

        {/* ── Startup ──────────────────────────────────────────────────── */}
        <section className="settings-section">
          <div className="settings-section-title">{t.startupLabel}</div>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.autoStart}
              onChange={e => onPatch({ autoStart: e.target.checked })}
            />
            <span>{t.autoStart}</span>
          </label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.minimizeToTray}
              onChange={e => onPatch({ minimizeToTray: e.target.checked })}
            />
            <span>{t.minimizeToTray}</span>
          </label>
        </section>

        {/* ── Window Behavior ───────────────────────────────────────────── */}
        <section className="settings-section">
          <div className="settings-section-title">{t.windowLabel}</div>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.autoHideOnBlur}
              onChange={e => onPatch({ autoHideOnBlur: e.target.checked })}
            />
            <span>{t.autoHide}</span>
          </label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.rememberPosition}
              onChange={e => onPatch({ rememberPosition: e.target.checked })}
            />
            <span>{t.rememberPos}</span>
          </label>
        </section>

        {/* ── Hotkey ────────────────────────────────────────────────────── */}
        <section className="settings-section">
          <div className="settings-section-title">{t.hotkeyLabel}</div>
          <div className="hotkey-display">
            <kbd>{hotkey}</kbd>
          </div>
          <p className="settings-hint">{t.hotkeyHint}</p>
        </section>

        {/* ── About ─────────────────────────────────────────────────────── */}
        <section className="settings-section">
          <div className="settings-section-title">{t.aboutLabel}</div>
          <div className="about-row">
            <span className="about-label">{t.version}</span>
            <span className="about-value">v{VERSION}</span>
          </div>
          <div className="about-row">
            <span className="about-label">{t.updateStatus}</span>
            <span className="about-value">
              {updateMsg
                ? <span className="update-ok">{updateMsg}</span>
                : <button className="link-btn" onClick={fakeCheckUpdate} disabled={checkingUpdate}>
                    {checkingUpdate ? "…" : t.checkUpdate}
                  </button>
              }
            </span>
          </div>
        </section>
      </div>

      {/* Footer actions */}
      <div className="settings-footer">
        <button className="settings-reset" onClick={onReset}>{t.resetBtn}</button>
        <div className="settings-footer-right">
          {saved && <span className="save-msg">{t.savedMsg}</span>}
          <button
            className={`settings-save ${dirty ? "active" : ""}`}
            onClick={onSave}
            disabled={!dirty}
          >
            {t.saveBtn}
          </button>
        </div>
      </div>
    </div>
  );
};
