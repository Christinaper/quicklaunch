import React from "react";

interface FooterProps {
  hotkey: string;
  mode: "pins" | "search";
  pinCount: number;
}

export const Footer: React.FC<FooterProps> = ({ hotkey, mode, pinCount }) => (
  <div className="footer">
    <div className="footer-hints">
      <span><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
      <span><kbd>↵</kbd> 打开</span>
      {mode === "search"
        ? <span><kbd>☆</kbd> Pin</span>
        : <span className="pin-hint-count">{pinCount > 0 ? `${pinCount} 个已固定` : "输入开始搜索"}</span>
      }
      <span><kbd>Esc</kbd> 关闭</span>
    </div>
    <div className="footer-brand">
      <kbd className="hotkey-badge">{hotkey}</kbd>
      <span>QuickLaunch</span>
    </div>
  </div>
);