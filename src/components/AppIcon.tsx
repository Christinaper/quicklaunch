import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AppIconProps {
  name: string;
  path?: string;      // .lnk path — if provided, real icon is fetched
  size?: number;
}

// ── Color avatar fallback ──────────────────────────────────────────────────────
const COLORS = [
  "#0078D4","#107C10","#D13438","#FF8C00",
  "#5C2D91","#008272","#E3008C","#004B87",
  "#0099BC","#8B0000","#FF6347","#4169E1",
];

function nameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

// In-memory icon cache: path → base64 PNG | "none" (failed)
const iconCache = new Map<string, string>();

export const AppIcon: React.FC<AppIconProps> = ({ name, path, size = 36 }) => {
  const [b64, setB64] = useState<string | null>(null);
  const fetchedRef    = useRef(false);

  useEffect(() => {
    if (!path || fetchedRef.current) return;
    fetchedRef.current = true;

    // Check cache first
    if (iconCache.has(path)) {
      const cached = iconCache.get(path)!;
      if (cached !== "none") setB64(cached);
      return;
    }

    // Fetch from Rust (PowerShell extraction, ~100ms per icon)
    invoke<string | null>("get_icon", { path })
      .then(result => {
        if (result) {
          iconCache.set(path, result);
          setB64(result);
        } else {
          iconCache.set(path, "none");
        }
      })
      .catch(() => iconCache.set(path, "none"));
  }, [path]);

  const letter = name.charAt(0).toUpperCase();
  const bg     = nameToColor(name);

  if (b64) {
    return (
      <img
        src={`data:image/png;base64,${b64}`}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: 6, objectFit: "contain", flexShrink: 0 }}
        onError={() => setB64(null)}   // fallback if base64 corrupt
      />
    );
  }

  // Color avatar fallback
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 8,
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.45, fontWeight: 600, color: "#fff",
      flexShrink: 0, letterSpacing: "-0.5px",
    }}>
      {letter}
    </div>
  );
};
