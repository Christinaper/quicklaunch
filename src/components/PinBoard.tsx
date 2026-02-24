import React, { useState, useRef, useCallback } from "react";
import type { PinItem } from "../hooks/usePins";
import { AppIcon } from "./AppIcon";

interface PinBoardProps {
  pins: PinItem[];
  onLaunch: (pin: PinItem) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, alias: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

interface ContextMenu {
  pinId: string;
  x: number;
  y: number;
}

export const PinBoard: React.FC<PinBoardProps> = ({
  pins, onLaunch, onRemove, onRename, onReorder, selectedIndex, onSelect,
}) => {
  const [editMode, setEditMode]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValue, setEditValue]   = useState("");
  const [ctxMenu, setCtxMenu]       = useState<ContextMenu | null>(null);

  // ── Drag state (only active in edit mode) ─────────────────────────────────
  const dragId   = useRef<string | null>(null);
  const dragOver = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  // ── Rename commit ─────────────────────────────────────────────────────────
  const commitEdit = useCallback((id: string) => {
    if (editValue.trim()) onRename(id, editValue.trim());
    setEditingId(null);
  }, [editValue, onRename]);

  // ── Drag handlers (edit mode only) ────────────────────────────────────────
  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = "move";
    // Needed for Firefox
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragId.current && dragId.current !== id) {
      dragOver.current = id;
      setDragOverId(id);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent, toId: string) => {
    e.preventDefault();
    if (dragId.current && dragId.current !== toId) {
      onReorder(dragId.current, toId);
    }
    dragId.current = null;
    dragOver.current = null;
    setDragOverId(null);
  }, [onReorder]);

  const onDragEnd = useCallback(() => {
    dragId.current = null;
    dragOver.current = null;
    setDragOverId(null);
  }, []);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (pins.length === 0) {
    return (
      <div className="pin-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
        </svg>
        <p>还没有 Pin</p>
        <span>搜索应用后，点击 ★ 将其固定到这里</span>
      </div>
    );
  }

  return (
    <>
      {/* Context menu overlay */}
      {ctxMenu && (
        <div className="ctx-overlay" onClick={closeCtx} onContextMenu={closeCtx}>
          <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={e => e.stopPropagation()}>
            <button className="ctx-item" onClick={() => ctxRename(ctxMenu.pinId)}>
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z"/>
              </svg>
              重命名
            </button>
            <div className="ctx-divider" />
            <button className="ctx-item danger" onClick={() => ctxRemove(ctxMenu.pinId)}>
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/>
              </svg>
              取消固定
            </button>
          </div>
        </div>
      )}

      <div className="pin-board">
        <div className="pin-section-label">
          <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
            <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/>
          </svg>
          已固定
          <span className="pin-count">{pins.length}</span>
          <button
            className={`pin-edit-toggle ${editMode ? "active" : ""}`}
            onClick={() => { setEditMode(m => !m); setEditingId(null); }}
            title={editMode ? "完成编辑" : "编辑排序"}
          >
            {editMode ? "完成" : "编辑"}
          </button>
        </div>

        <div className="pin-grid">
          {pins.map((pin, i) => (
            <div
              key={pin.id}
              className={[
                "pin-item",
                i === selectedIndex && !editMode ? "selected" : "",
                editMode ? "edit-mode" : "",
                dragOverId === pin.id ? "drag-over" : "",
              ].filter(Boolean).join(" ")}
              draggable={editMode}
              onDragStart={editMode ? (e) => onDragStart(e, pin.id) : undefined}
              onDragEnter={editMode ? (e) => onDragEnter(e, pin.id) : undefined}
              onDragOver={editMode ? onDragOver : undefined}
              onDrop={editMode ? (e) => onDrop(e, pin.id) : undefined}
              onDragEnd={editMode ? onDragEnd : undefined}
              onMouseEnter={() => !editMode && onSelect(i)}
              onContextMenu={(e) => handleContextMenu(e, pin)}
              onClick={() => {
                if (editMode) return;
                if (editingId) return;
                onLaunch(pin);
              }}
            >
              {/* Drag handle — only visible in edit mode */}
              {editMode && (
                <div className="pin-drag-handle" title="拖拽排序">
                  ⠿
                </div>
              )}

              <AppIcon name={pin.app.name} size={32} />

              {editingId === pin.id ? (
                <input
                  className="pin-rename-input"
                  value={editValue}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(pin.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  commitEdit(pin.id);
                    if (e.key === "Escape") setEditingId(null);
                    e.stopPropagation();
                  }}
                />
              ) : (
                <span className="pin-name" title={pin.alias}>
                  {pin.alias}
                </span>
              )}

              {i === selectedIndex && !editMode && <div className="pin-selected-ring" />}
            </div>
          ))}
        </div>

        <p className="pin-tip">
          {editMode ? "拖拽卡片排序 · 右键重命名或取消固定 · 点击「完成」退出" : "右键卡片可重命名或取消固定"}
        </p>
      </div>
    </>
  );
};
