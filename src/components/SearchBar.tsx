import React, { useRef, useEffect } from "react";
import type { Strings } from "../hooks/useSettings";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  resultCount: number;
  mode: "pins" | "search";
  t: Strings;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value, onChange, loading, resultCount, mode, t,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  return (
    <div className="search-bar">
      <svg className="search-icon" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder={mode === "pins" ? t.searchPlaceholder : t.searchingPlaceholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete="off" autoCorrect="off" spellCheck={false}
      />

      <div className="search-meta">
        {loading
          ? <span className="search-loading"><span className="spinner" /></span>
          : value
            ? <span className="search-count">{resultCount} 个</span>
            : null
        }
      </div>
    </div>
  );
};
