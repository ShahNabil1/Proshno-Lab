import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

// --- Node View Component ---
function ResizableImageComponent({ node, updateAttributes, selected }: any) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);
  const startData = useRef<{ startX: number; startY: number; startW: number; startH: number; corner: string }>({
    startX: 0, startY: 0, startW: 0, startH: 0, corner: "",
  });

  const { src, alt, title, width, height } = node.attrs;

  const onMouseDown = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    startData.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: img.offsetWidth,
      startH: img.offsetHeight,
      corner,
    };
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const { startX, startY, startW, startH, corner } = startData.current;
      let newW = startW;
      let newH = startH;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (corner === "se") {
        newW = Math.max(30, startW + dx);
        newH = Math.max(30, startH + dy);
      } else if (corner === "sw") {
        newW = Math.max(30, startW - dx);
        newH = Math.max(30, startH + dy);
      } else if (corner === "ne") {
        newW = Math.max(30, startW + dx);
        newH = Math.max(30, startH - dy);
      } else if (corner === "nw") {
        newW = Math.max(30, startW - dx);
        newH = Math.max(30, startH - dy);
      } else if (corner === "e") {
        newW = Math.max(30, startW + dx);
      } else if (corner === "w") {
        newW = Math.max(30, startW - dx);
      } else if (corner === "s") {
        newH = Math.max(30, startH + dy);
      } else if (corner === "n") {
        newH = Math.max(30, startH - dy);
      }

      updateAttributes({ width: newW, height: newH });
    };
    const onMouseUp = () => setResizing(false);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizing, updateAttributes]);

  // Touch support
  const onTouchStart = useCallback((e: React.TouchEvent, corner: string) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const img = imgRef.current;
    if (!img) return;
    startData.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startW: img.offsetWidth,
      startH: img.offsetHeight,
      corner,
    };
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const { startX, startY, startW, startH, corner } = startData.current;
      let newW = startW;
      let newH = startH;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (corner === "se") { newW = Math.max(30, startW + dx); newH = Math.max(30, startH + dy); }
      else if (corner === "e") { newW = Math.max(30, startW + dx); }
      else if (corner === "s") { newH = Math.max(30, startH + dy); }
      updateAttributes({ width: newW, height: newH });
    };
    const onTouchEnd = () => setResizing(false);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [resizing, updateAttributes]);

  const handleStyle = "absolute w-2.5 h-2.5 bg-primary border border-primary-foreground rounded-sm z-10";

  return (
    <NodeViewWrapper as="span" className="inline-block" style={{ lineHeight: 0 }}>
      <span
        className="relative inline-block group"
        style={{ width: width ? `${width}px` : "auto", height: height ? `${height}px` : "auto" }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt || ""}
          title={title || ""}
          draggable={false}
          className={`block max-w-full ${selected ? "ring-2 ring-primary" : ""}`}
          style={{
            width: width ? `${width}px` : "auto",
            height: height ? `${height}px` : "auto",
            cursor: "default",
          }}
        />
        {/* Resize handles - visible on hover/select */}
        <span className={`${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
          {/* Corners */}
          <span className={`${handleStyle} -top-1 -left-1 cursor-nw-resize`} onMouseDown={(e) => onMouseDown(e, "nw")} onTouchStart={(e) => onTouchStart(e, "nw")} />
          <span className={`${handleStyle} -top-1 -right-1 cursor-ne-resize`} onMouseDown={(e) => onMouseDown(e, "ne")} onTouchStart={(e) => onTouchStart(e, "ne")} />
          <span className={`${handleStyle} -bottom-1 -left-1 cursor-sw-resize`} onMouseDown={(e) => onMouseDown(e, "sw")} onTouchStart={(e) => onTouchStart(e, "sw")} />
          <span className={`${handleStyle} -bottom-1 -right-1 cursor-se-resize`} onMouseDown={(e) => onMouseDown(e, "se")} onTouchStart={(e) => onTouchStart(e, "se")} />
          {/* Edges */}
          <span className={`${handleStyle} top-1/2 -translate-y-1/2 -left-1 cursor-w-resize`} onMouseDown={(e) => onMouseDown(e, "w")} />
          <span className={`${handleStyle} top-1/2 -translate-y-1/2 -right-1 cursor-e-resize`} onMouseDown={(e) => onMouseDown(e, "e")} />
          <span className={`${handleStyle} left-1/2 -translate-x-1/2 -top-1 cursor-n-resize`} onMouseDown={(e) => onMouseDown(e, "n")} />
          <span className={`${handleStyle} left-1/2 -translate-x-1/2 -bottom-1 cursor-s-resize`} onMouseDown={(e) => onMouseDown(e, "s")} />
        </span>
      </span>
    </NodeViewWrapper>
  );
}

// --- Custom Extension ---
export const ResizableImage = Node.create({
  name: "image",
  group: "inline",
  inline: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute("width") || el.style.width;
          return w ? parseInt(w, 10) || null : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.width) return {};
          return { width: attrs.width, style: `width: ${attrs.width}px` };
        },
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const h = el.getAttribute("height") || el.style.height;
          return h ? parseInt(h, 10) || null : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.height) return {};
          return { height: attrs.height, style: `height: ${attrs.height}px` };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, height, ...rest } = HTMLAttributes;
    const styles: string[] = [];
    if (width) styles.push(`width: ${width}px`);
    if (height) styles.push(`height: ${height}px`);
    return [
      "img",
      mergeAttributes(rest, {
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
        ...(styles.length ? { style: styles.join("; ") } : {}),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent);
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string; title?: string; width?: number; height?: number }) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
