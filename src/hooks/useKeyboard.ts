import { useEffect, useCallback } from "react";

interface UseKeyboardOptions {
  resultsLength: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onConfirm: (index: number) => void;
  onEscape: () => void;
}

export function useKeyboard({
  resultsLength,
  selectedIndex,
  onSelect,
  onConfirm,
  onEscape,
}: UseKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          onSelect(Math.min(selectedIndex + 1, resultsLength - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          onSelect(Math.max(selectedIndex - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (resultsLength > 0) onConfirm(selectedIndex);
          break;
        case "Escape":
          e.preventDefault();
          onEscape();
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            onSelect(Math.max(selectedIndex - 1, 0));
          } else {
            onSelect(Math.min(selectedIndex + 1, resultsLength - 1));
          }
          break;
      }
    },
    [resultsLength, selectedIndex, onSelect, onConfirm, onEscape]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
