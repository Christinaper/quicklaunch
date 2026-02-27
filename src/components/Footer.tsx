import React from "react";
import type { Strings } from "../hooks/useSettings";

interface FooterProps {
  hotkey: string;
  mode: "pins" | "search";
  pinCount: number;
  t: Strings;
}

export const Footer: React.FC<FooterProps> = ({ hotkey, mode, pinCount, t }) => (
  <div className="footer">
    <div className="footer-hints">
      <span><kbd>↑</kbd><kbd>↓</kbd> {t.navigate}</span>
      <span><kbd>↵</kbd> {t.open}</span>
      {mode === "search"
        ? <span><kbd>☆</kbd> {t.pin}</span>
        : <span className="pin-hint-count">
            {pinCount > 0 ? t.nPinned(pinCount) : t.typeToSearch}
          </span>
      }
      <span><kbd>Esc</kbd> {mode === "search" ? t.back : t.close}</span>
    </div>
    <div className="footer-brand">
      <kbd className="hotkey-badge">{hotkey}</kbd>
      <span>QuickLaunch</span>
    </div>
  </div>
);
