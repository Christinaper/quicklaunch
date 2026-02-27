import React, { useEffect, useRef } from "react";
import type { AppEntry } from "../hooks/useApps";
import { AppIcon } from "./AppIcon";

interface ResultListProps {
  results: AppEntry[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onLaunch: (app: AppEntry) => void;
  onPinToggle: (app: AppEntry, e: React.MouseEvent) => void;
  isPinned: (path: string) => boolean;
  query: string;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export const ResultList: React.FC<ResultListProps> = ({
  results,
  selectedIndex,
  onSelect,
  onLaunch,
  onPinToggle,
  isPinned,
  query,
}) => {
  const selectedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (results.length === 0 && query) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9.172 16.172a4 4 0 0 1 5.656 0" />
          <circle cx="9" cy="10" r="1" fill="currentColor" />
          <circle cx="15" cy="10" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="10" strokeLinecap="round" />
        </svg>
        <p>未找到 "<strong>{query}</strong>"</p>
        <span>请检查拼写或尝试其他关键词</span>
      </div>
    );
  }

  return (
    <div className="result-list" role="listbox">
      {results.map((app, i) => (
        <div
          key={app.path}
          ref={i === selectedIndex ? selectedRef : null}
          className={`result-item ${i === selectedIndex ? "selected" : ""}`}
          role="option"
          aria-selected={i === selectedIndex}
          onMouseEnter={() => onSelect(i)}
          onClick={() => onLaunch(app)}
        >
          <AppIcon name={app.name} path={app.path} size={36} />

          <div className="result-info">
            <span className="result-name">
              {highlightMatch(app.name, query)}
            </span>
            <span className="result-category">{app.category}</span>
          </div>

          <button
            className={`pin-star ${isPinned(app.path) ? "pinned" : ""}`}
            title={isPinned(app.path) ? "取消固定" : "固定到主页"}
            onClick={(e) => onPinToggle(app, e)}
          >
            {isPinned(app.path) ? "★" : "☆"}
          </button>

          {i === selectedIndex && (
            <div className="result-enter-hint">
              <kbd>↵</kbd>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
