import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent,
  ImageIcon, TableIcon, Link as LinkIcon,
  Undo2, Redo2, Subscript as SubIcon, Superscript as SupIcon,
  Maximize2, Palette, Highlighter, Sigma
} from "lucide-react";
import MathSymbolsModal from "./MathSymbolsModal";
import LatexRenderer from "./LatexRenderer";
import katex from "katex";
import { toast } from "sonner";

const TEXT_COLORS = [
  "#000000", "#333333", "#666666", "#999999",
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];
const BG_COLORS = [
  "transparent", "#fef3c7", "#fce7f3", "#dbeafe",
  "#d1fae5", "#ede9fe", "#fee2e2", "#e0e7ff",
  "#ccfbf1", "#fef9c3", "#f3e8ff", "#cffafe",
];

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your main question here...",
  minHeight = "150px",
}: RichTextEditorProps) {
  const [mathModalOpen, setMathModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cloudinaryConfig, setCloudinaryConfig] = useState<{ cloudName: string; uploadPreset: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;
    fetch(`https://${projectId}.supabase.co/functions/v1/cloudinary-config`)
      .then(r => r.json())
      .then(d => { if (d.cloudName) setCloudinaryConfig(d); })
      .catch(() => {});
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[inherit] px-3 py-2 prose prose-sm max-w-none font-body",
        style: `min-height: ${minHeight}; font-family: 'SolaimanLipi', sans-serif;`,
      },
    },
  });

  const insertMathSymbol = useCallback(
    (tex: string) => {
      if (!editor) return;
      try {
        const html = katex.renderToString(tex, { throwOnError: false, displayMode: false });
        editor.chain().focus().insertContent(html).run();
      } catch {
        editor.chain().focus().insertContent(`$${tex}$`).run();
      }
    },
    [editor]
  );

  const handleImageUpload = useCallback(async () => {
    if (!cloudinaryConfig) {
      // Fallback: prompt for URL
      const url = prompt("ইমেজ URL দিন:");
      if (url && editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
      return;
    }
    fileInputRef.current?.click();
  }, [editor, cloudinaryConfig]);

  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor || !cloudinaryConfig) return;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", cloudinaryConfig.uploadPreset);

      try {
        toast.info("ইমেজ আপলোড হচ্ছে...");
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();
        if (data.secure_url) {
          editor.chain().focus().setImage({ src: data.secure_url }).run();
          toast.success("ইমেজ যোগ হয়েছে!");
        } else {
          toast.error("আপলোড ব্যর্থ");
        }
      } catch {
        toast.error("আপলোড ব্যর্থ");
      }
      e.target.value = "";
    },
    [editor, cloudinaryConfig]
  );

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertLink = useCallback(() => {
    const url = prompt("লিংক URL:");
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const wrapperClass = isFullscreen
    ? "fixed inset-0 z-50 bg-background flex flex-col"
    : "border border-border rounded-lg overflow-hidden bg-background";

  return (
    <div className={wrapperClass}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-1.5 py-1 text-xs">
        {/* MathJax label */}
        <button
          type="button"
          onClick={() => setMathModalOpen(true)}
          className="px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded"
        >
          mathjax
        </button>

        <ToolBtn icon={<Bold className="h-3.5 w-3.5" />} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold" />
        <ToolBtn icon={<Italic className="h-3.5 w-3.5" />} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic" />
        <ToolBtn icon={<UnderlineIcon className="h-3.5 w-3.5" />} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline" />
        <ToolBtn icon={<SubIcon className="h-3.5 w-3.5" />} active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()} title="Subscript" />
        <ToolBtn icon={<SupIcon className="h-3.5 w-3.5" />} active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="Superscript" />
        <ToolBtn icon={<Strikethrough className="h-3.5 w-3.5" />} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough" />

        <button
          type="button"
          onClick={() => {
            const formula = prompt("সূত্র বা সমীকরণ লিখুন (LaTeX):");
            if (formula) insertMathSymbol(formula);
          }}
          className="px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded"
        >
          সূত্রাবলি
        </button>

        <Sep />

        <ToolBtn icon={<List className="h-3.5 w-3.5" />} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bulleted List" />
        <ToolBtn icon={<ListOrdered className="h-3.5 w-3.5" />} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List" />

        {/* Alignment dropdown-like buttons */}
        <ToolBtn icon={<AlignLeft className="h-3.5 w-3.5" />} active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Left" />
        <ToolBtn icon={<AlignCenter className="h-3.5 w-3.5" />} active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center" />
        <ToolBtn icon={<AlignRight className="h-3.5 w-3.5" />} active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Right" />
        <ToolBtn icon={<AlignJustify className="h-3.5 w-3.5" />} active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Justify" />

        <Sep />

        {/* Text size / heading */}
        <select
          className="h-6 text-[11px] border border-border rounded bg-background px-1"
          value={
            editor.isActive("heading", { level: 1 }) ? "h1" :
            editor.isActive("heading", { level: 2 }) ? "h2" :
            editor.isActive("heading", { level: 3 }) ? "h3" :
            editor.isActive("heading", { level: 4 }) ? "h4" : "p"
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: parseInt(v[1]) as 1 | 2 | 3 | 4 }).run();
          }}
        >
          <option value="p">TI</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
        </select>

        <Sep />

        <ToolBtn icon={<Maximize2 className="h-3.5 w-3.5" />} onClick={() => setIsFullscreen(!isFullscreen)} title="ফুলস্ক্রিন" />
        <ToolBtn icon={<ImageIcon className="h-3.5 w-3.5" />} onClick={handleImageUpload} title="ইমেজ" />
        <ToolBtn icon={<TableIcon className="h-3.5 w-3.5" />} onClick={insertTable} title="টেবিল" />

        {/* Text Color */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent" title="টেক্সট কালার">
              <Palette className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="bottom" align="center">
            <p className="text-[10px] text-muted-foreground mb-1">টেক্সট কালার</p>
            <div className="grid grid-cols-4 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-5 w-5 rounded-full border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  onClick={() => editor.chain().focus().setColor(c).run()}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mb-1 mt-2">ব্যাকগ্রাউন্ড কালার</p>
            <div className="grid grid-cols-4 gap-1">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-5 w-5 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c === "transparent" ? "#fff" : c }}
                  onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <ToolBtn icon={<LinkIcon className="h-3.5 w-3.5" />} active={editor.isActive("link")} onClick={insertLink} title="লিংক" />

        <Sep />

        <button
          type="button"
          onClick={() => setMathModalOpen(true)}
          className="px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent rounded flex items-center gap-0.5"
        >
          <Sigma className="h-3 w-3" /> mathSymbols
        </button>
      </div>

      {/* Editor content */}
      <div className={`overflow-y-auto ${isFullscreen ? "flex-1" : ""}`} style={{ minHeight: isFullscreen ? undefined : minHeight }}>
        <EditorContent editor={editor} className="w-full" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-2 py-1 text-[10px] text-muted-foreground bg-muted/20">
        <div className="flex items-center gap-2">
          <Undo2 className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => editor.chain().focus().undo().run()} />
          <Redo2 className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => editor.chain().focus().redo().run()} />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="rte-preview" className="text-[10px] cursor-pointer">প্রিভিউ</Label>
          <Switch id="rte-preview" checked={showPreview} onCheckedChange={setShowPreview} className="scale-[0.6]" />
        </div>
      </div>

      {/* Preview */}
      {showPreview && value && (
        <div
          className="border-t border-border bg-muted/30 p-3 text-sm prose prose-sm max-w-none font-body"
          style={{ fontFamily: "'SolaimanLipi', sans-serif" }}
          dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
        />
      )}

      {/* Hidden file input for image upload */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />

      {/* Math Symbols Modal */}
      <MathSymbolsModal
        open={mathModalOpen}
        onClose={() => setMathModalOpen(false)}
        onInsert={insertMathSymbol}
      />
    </div>
  );
}

function ToolBtn({ icon, active, onClick, title }: { icon: React.ReactNode; active?: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {icon}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border mx-0.5" />;
}
