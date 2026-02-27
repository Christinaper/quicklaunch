import React, { useState, useRef, useCallback } from "react";
import type { PinItem } from "../hooks/usePins";
import type { Strings } from "../hooks/useSettings";
import { AppIcon } from "./AppIcon";

interface PinBoardProps {
  pins: PinItem[];
  onLaunch: (pin: PinItem) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, alias: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  selectedIndex: number;
  onSelect: (index: number) => void;
  t: Strings;
}

interface CtxMenu { pinId: string; x: number; y: number; }

export const PinBoard: React.FC<PinBoardProps> = ({
  pins, onLaunch, onRemove, onRename, onReorder, selectedIndex, onSelect, t,
}) => {
  const [editMode,   setEditMode]   = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editValue,  setEditValue]  = useState("");
  const [ctxMenu,    setCtxMenu]    = useState<CtxMenu | null>(null);

  // ── Pointer-based drag (avoids HTML5 drag-API issues in WebView2) ──────────
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overIdx,    setOverIdx]    = useState<number | null>(null);
  const pointerOrigin               = useRef<{ x: number; y: number } | null>(null);
  const didDrag                     = useRef(false);          // distinguish drag vs click

  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (!editMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerOrigin.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
    setDraggingId(id);
  }, [editMode]);

  const handlePointerMove = useCallback((e: React.PointerEvent, idx: number) => {
    if (!draggingId) return;
    const dist = pointerOrigin.current
      ? Math.hypot(e.clientX - pointerOrigin.current.x, e.clientY - pointerOrigin.current.y)
      : 0;
    if (dist > 4) didDrag.current = true;
    setOverIdx(idx);
  }, [draggingId]);

  const handlePointerUp = useCallback((e: React.PointerEvent, pin: PinItem) => {
    if (!draggingId) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (didDrag.current && overIdx !== null) {
      const toPin = pins[overIdx];
      if (toPin && toPin.id !== draggingId) {
        onReorder(draggingId, toPin.id);
      }
    }
    // If no drag movement → treat as click (launch)
    if (!didDrag.current && !editMode) {
      onLaunch(pin);
    }

    setDraggingId(null);
    setOverIdx(null);
    pointerOrigin.current = null;
    didDrag.current = false;
  }, [draggingId, overIdx, pins, onReorder, onLaunch, editMode]);

  // ── Context menu ──────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, pin: PinItem) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ pinId: pin.id, x: e.clientX, y: e.clientY });
  }, []);

  const closeCtx = useCallback(() => setCtxMenu(null), []);

  const ctxRename = useCallback((pinId: string) => {
    const pin = pins.find(p => p.id === pinId);
    if (pin) { setEditingId(pinId); setEditValue(pin.alias); }
    setCtxMenu(null);
  }, [pins]);

  const ctxRemove = useCallback((pinId: string) => {
    onRemove(pinId);
    setCtxMenu(null);
  }, [onRemove]);

  // ── Rename ────────────────────────────────────────────────────────────────
  const commitEdit = useCallback((id: string) => {
    if (editValue.trim()) onRename(id, editValue.trim());
    setEditingId(null);
  }, [editValue, onRename]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (pins.length === 0) {
    return (
      <div className="pin-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
        </svg>
        <p>{t.emptyPin}</p>
        <span>{t.emptyPinHint}</span>
      </div>
    );
  }

  return (
    <>
      {/* Context menu */}
      {ctxMenu && (
        <div className="ctx-overlay" onClick={closeCtx} onContextMenu={e => { e.preventDefault(); closeCtx(); }}>
          <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={e => e.stopPropagation()}>
            <button className="ctx-item" onClick={() => ctxRename(ctxMenu.pinId)}>
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/>
              </svg>
              {t.rename}
            </button>
            <div className="ctx-divider" />
            <button className="ctx-item danger" onClick={() => ctxRemove(ctxMenu.pinId)}>
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1h3a1 1 0 0 1 1 1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11z"/>
              </svg>
              {t.unpin}
            </button>
          </div>
        </div>
      )}

      <div className="pin-board">
        <div className="pin-section-label">
          <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
            <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/>
          </svg>
          {t.pinned}
          <span className="pin-count">{pins.length}</span>
          <button
            className={`pin-edit-toggle ${editMode ? "active" : ""}`}
            onClick={() => { setEditMode(m => !m); setEditingId(null); }}
          >
            {editMode ? t.done : t.edit}
          </button>
        </div>

        <div className="pin-grid">
          {pins.map((pin, i) => {
            const isDragging = draggingId === pin.id;
            const isOver     = editMode && overIdx === i && draggingId !== pin.id;

            return (
              <div
                key={pin.id}
                className={[
                  "pin-item",
                  i === selectedIndex && !editMode ? "selected" : "",
                  editMode    ? "edit-mode"  : "",
                  isDragging  ? "is-dragging": "",
                  isOver      ? "drag-over"  : "",
                ].filter(Boolean).join(" ")}
                onPointerDown={editMode ? e => handlePointerDown(e, pin.id) : undefined}
                onPointerMove={editMode ? e => handlePointerMove(e, i) : undefined}
                onPointerUp={editMode
                  ? e => handlePointerUp(e, pin)
                  : undefined
                }
                onMouseEnter={() => !editMode && onSelect(i)}
                onContextMenu={e => handleContextMenu(e, pin)}
                onClick={() => {
                  // only fire click in normal mode and only if not dragging
                  if (!editMode && !didDrag.current) onLaunch(pin);
                }}
              >
                {editMode && (
                  <div className="pin-drag-handle">⠿</div>
                )}

                <AppIcon name={pin.app.name} path={pin.app.path} size={32} />

                {editingId === pin.id ? (
                  <input
                    className="pin-rename-input"
                    value={editValue}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(pin.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter")  commitEdit(pin.id);
                      if (e.key === "Escape") setEditingId(null);
                      e.stopPropagation();
                    }}
                  />
                ) : (
                  <span className="pin-name" title={pin.alias}>{pin.alias}</span>
                )}

                {i === selectedIndex && !editMode && <div className="pin-selected-ring" />}
              </div>
            );
          })}
        </div>

        <p className="pin-tip">
          {editMode ? t.pinTipEdit : t.pinTipNormal}
        </p>
      </div>
    </>
  );
};
