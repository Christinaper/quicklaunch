import { useState, useCallback, useEffect } from "react";
import type { AppEntry } from "./useApps";

export interface PinItem {
  id: string;          // unique stable id
  app: AppEntry;
  alias: string;       // custom display name (defaults to app.name)
  order: number;
}

const STORAGE_KEY = "quicklaunch:pins";

function loadPins(): PinItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PinItem[]) : [];
  } catch {
    return [];
  }
}

function savePins(pins: PinItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}

export function usePins() {
  const [pins, setPins] = useState<PinItem[]>(() =>
    loadPins().sort((a, b) => a.order - b.order)
  );

  // Sync to localStorage on every change
  useEffect(() => {
    savePins(pins);
  }, [pins]);

  const addPin = useCallback((app: AppEntry) => {
    setPins((prev) => {
      if (prev.some((p) => p.app.path === app.path)) return prev; // already pinned
      const newPin: PinItem = {
        id: `pin-${Date.now()}`,
        app,
        alias: app.name,
        order: prev.length,
      };
      return [...prev, newPin];
    });
  }, []);

  const removePin = useCallback((id: string) => {
    setPins((prev) =>
      prev
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, order: i }))
    );
  }, []);

  const renamePin = useCallback((id: string, alias: string) => {
    setPins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, alias } : p))
    );
  }, []);

  // Drag-to-reorder: swap two pins by id
  const reorderPins = useCallback((fromId: string, toId: string) => {
    setPins((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((p) => p.id === fromId);
      const toIdx   = arr.findIndex((p) => p.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr.map((p, i) => ({ ...p, order: i }));
    });
  }, []);

  const isPinned = useCallback(
    (path: string) => pins.some((p) => p.app.path === path),
    [pins]
  );

  return { pins, addPin, removePin, renamePin, reorderPins, isPinned };
}
