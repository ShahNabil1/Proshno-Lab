import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Minus, Plus, Trash2, RefreshCw, Palette
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FloatingToolbarProps {
  targetEl: HTMLElement | null;
  onDelete?: () => void;
  onExchange?: () => void;
  onClose: () => void;
}

const COLORS = [
  "#000000", "#1f2937", "#4b5563", "#9ca3af",
  "#ffffff", "#fef08a", "#fdba74", "#f9a8d4",
  "#ef4444", "#dc2626", "#b91c1c", "#7f1d1d",
  "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#10b981", "#059669", "#047857", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#2563eb",
  "#1e3a8a", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#ec4899", "#f43f5e", "#78350f",
];


export default function FloatingToolbar({ targetEl, onDelete, onExchange, onClose }: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [fontSize, setFontSize] = useState(14);
  const [currentColor, setCurrentColor] = useState("#000000");


  // Position toolbar above the target element
  useEffect(() => {
    if (!targetEl || !toolbarRef.current) return;
    const rect = targetEl.getBoundingClientRect();
    const tbRect = toolbarRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;

    let top = rect.top + scrollY - tbRect.height - 8;
    if (top < scrollY + 10) top = rect.bottom + scrollY + 8;
    let left = rect.left + rect.width / 2 - tbRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tbRect.width - 8));

    setPos({ top, left });

    // Read current font size + colour
    const computed = window.getComputedStyle(targetEl);
    setFontSize(Math.round(parseFloat(computed.fontSize)));
    const rgb = computed.color.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      setCurrentColor(
        "#" + rgb.slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("")
      );
    }
  }, [targetEl]);

  // Keep track of the last selection made inside the editable element,
  // so opening the colour popover (which steals focus) doesn't lose it.
  useEffect(() => {
    if (!targetEl) return;
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (targetEl.contains(range.commonAncestorContainer)) {
        savedRange.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", handler);
    handler();
    return () => document.removeEventListener("selectionchange", handler);
  }, [targetEl]);



  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const node = e.target as HTMLElement | null;
      // Ignore clicks inside portalled popovers (colour picker) — they belong to the toolbar
      if (node?.closest?.("[data-radix-popper-content-wrapper]")) return;
      if (
        toolbarRef.current && !toolbarRef.current.contains(e.target as Node) &&
        targetEl && !targetEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [targetEl, onClose]);

  const exec = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    targetEl?.focus();
  }, [targetEl]);

  const changeFontSize = (delta: number) => {
    if (!targetEl) return;
    const newSize = Math.max(10, Math.min(28, fontSize + delta));
    setFontSize(newSize);
    targetEl.style.fontSize = `${newSize}px`;
  };

  const setAlign = (align: string) => {
    if (!targetEl) return;
    targetEl.style.textAlign = align;
  };

  const setColor = (color: string) => {
    if (!targetEl) return;
    setCurrentColor(color);
    const sel = window.getSelection();
    const range = savedRange.current;
    const hasTextSelection =
      range && !range.collapsed && targetEl.contains(range.commonAncestorContainer);

    if (hasTextSelection && sel) {
      // Restore the selection that was lost when the popover opened
      targetEl.focus();
      sel.removeAllRanges();
      sel.addRange(range!);
      try { document.execCommand("styleWithCSS", false, "true"); } catch { /* noop */ }
      document.execCommand("foreColor", false, color);
    } else {
      // No selection -> colour the whole editable element
      targetEl.style.color = color;
      targetEl.querySelectorAll<HTMLElement>("[style*='color']").forEach(el => {
        el.style.color = color;
      });
      targetEl.querySelectorAll<HTMLFontElement>("font[color]").forEach(el => {
        el.removeAttribute("color");
        el.style.color = color;
      });
    }
  };


  if (!targetEl) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[100] flex items-center gap-0.5 rounded-lg border border-emerald-300 bg-white dark:bg-card shadow-xl px-1.5 py-1 font-paper"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Font size */}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeFontSize(-1)}>
        <Minus className="h-3 w-3" />
      </Button>
      <span className="text-xs font-medium w-6 text-center select-none">{fontSize}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeFontSize(1)}>
        <Plus className="h-3 w-3" />
      </Button>

      <div className="w-px h-5 bg-emerald-200 mx-0.5" />

      {/* Formatting */}
      <Button variant="ghost" size="icon" className="h-7 w-7 font-bold" onClick={() => exec("bold")}>
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("italic")}>
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec("underline")}>
        <Underline className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-5 bg-emerald-200 mx-0.5" />

      {/* Alignment */}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAlign("left")}>
        <AlignLeft className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAlign("center")}>
        <AlignCenter className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAlign("right")}>
        <AlignRight className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-5 bg-emerald-200 mx-0.5" />

      {/* Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 relative"
            onMouseDown={e => e.preventDefault()}
            title="লেখার রং"
          >
            <Palette className="h-3.5 w-3.5" style={{ color: currentColor }} />
            <span
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-4 rounded-sm border border-border"
              style={{ backgroundColor: currentColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 p-2.5 space-y-2"
          side="bottom"
          align="center"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <div className="grid grid-cols-8 gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                className="h-5 w-5 rounded-full border border-border hover:scale-125 transition-transform"
                style={{ backgroundColor: c }}
                title={c}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setColor(c)}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : "#000000"}
              onChange={e => setColor(e.target.value)}
              className="h-7 w-9 p-0 rounded border border-border bg-transparent cursor-pointer"
              title="কাস্টম রং"
            />
            <input
              type="text"
              value={currentColor}
              placeholder="#10b981"
              onMouseDown={e => e.stopPropagation()}
              onChange={e => {
                const v = e.target.value.trim();
                setCurrentColor(v);
                if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) setColor(v);
              }}
              className="flex-1 h-7 px-2 text-xs rounded border border-border bg-background font-mono"
            />
          </div>
        </PopoverContent>
      </Popover>


      <div className="w-px h-5 bg-emerald-200 mx-0.5" />

      {/* Exchange & Delete */}
      {onExchange && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" onClick={onExchange} title="বদলান">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="মুছুন">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
