import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Fuse from "fuse.js";

export interface AppEntry {
  name: string;
  path: string;
  icon: string | null;
  category: string;
}

// ── Acronym / initials matching ──────────────────────────────────────────────
// "vsc" → matches "Visual Studio Code" (first letter of each word)
// "vs"  → matches "Visual Studio Code" (prefix of initials)
function getInitials(name: string): string {
  return name
    .split(/[\s\-_\.]+/)
    .map(w => w[0] ?? "")
    .join("")
    .toLowerCase();
}

// Does the query match as a contiguous substring of the initials?
function initialsMatch(name: string, query: string): boolean {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const initials = getInitials(name);
  return initials.includes(q);
}

// Does query match as contiguous chars inside the name (case-insensitive)?
function substringMatch(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}

// Score: lower = better match
function score(app: AppEntry, query: string): number {
  const name = app.name.toLowerCase();
  const q    = query.toLowerCase();

  if (name === q)                  return 0;   // exact
  if (name.startsWith(q))          return 1;   // prefix
  if (substringMatch(app.name, q)) return 2;   // substring
  if (initialsMatch(app.name, q))  return 3;   // initials (e.g. "vs" → VSCode)
  return 99;
}

const FUSE_OPTIONS = {
  keys: ["name", "category"],
  threshold: 0.4,
  minMatchCharLength: 1,
  includeScore: true,
  shouldSort: true,
};

export function useApps() {
  const [apps, setApps]       = useState<AppEntry[]>([]);
  const [results, setResults] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const fuseRef               = useRef<Fuse<AppEntry> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await invoke<AppEntry[]>("get_apps");
        setApps(data);
        fuseRef.current = new Fuse(data, FUSE_OPTIONS);
        setResults(data.slice(0, 8));
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const search = useCallback((query: string) => {
    if (!query.trim()) { setResults(apps.slice(0, 8)); return; }

    const q = query.trim();

    // 1. Collect exact / prefix / substring / initials matches first
    const direct = apps
      .map(app => ({ app, s: score(app, q) }))
      .filter(x => x.s < 99)
      .sort((a, b) => a.s - b.s)
      .map(x => x.app);

    // 2. Fuse fuzzy for anything not already found
    const directPaths = new Set(direct.map(a => a.path));
    const fuzzy = fuseRef.current
      ? fuseRef.current.search(q)
          .map(r => r.item)
          .filter(a => !directPaths.has(a.path))
      : [];

    setResults([...direct, ...fuzzy].slice(0, 8));
  }, [apps]);

  const launch = useCallback(async (app: AppEntry) => {
    await invoke("launch_app", { path: app.path });
    await invoke("hide_window");
  }, []);

  return { apps, results, loading, error, search, launch };
}
