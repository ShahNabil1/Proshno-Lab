import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import LatexRenderer from "@/components/LatexRenderer";
import { Sigma } from "lucide-react";

const MATH_SYMBOLS = [
  { label: "ভগ্নাংশ", tex: "\\frac{a}{b}" },
  { label: "বর্গমূল", tex: "\\sqrt{x}" },
  { label: "n-তম মূল", tex: "\\sqrt[n]{x}" },
  { label: "সুপারস্ক্রিপ্ট", tex: "x^{2}" },
  { label: "সাবস্ক্রিপ্ট", tex: "x_{i}" },
  { label: "সমাকলন", tex: "\\int_{a}^{b}" },
  { label: "সিগমা", tex: "\\sum_{i=1}^{n}" },
  { label: "ভেক্টর", tex: "\\vec{A}" },
  { label: "ডিগ্রী", tex: "^\\circ" },
  { label: "পাই", tex: "\\pi" },
  { label: "থিটা", tex: "\\theta" },
  { label: "আলফা", tex: "\\alpha" },
  { label: "বিটা", tex: "\\beta" },
  { label: "ডেল্টা", tex: "\\Delta" },
  { label: "ইনফিনিটি", tex: "\\infty" },
  { label: "নট ইকুয়াল", tex: "\\neq" },
  { label: "লেস/ইকুয়াল", tex: "\\leq" },
  { label: "গ্রেটার/ইকুয়াল", tex: "\\geq" },
  { label: "ক্রস প্রোডাক্ট", tex: "\\times" },
  { label: "ডট প্রোডাক্ট", tex: "\\cdot" },
  { label: "সাইন", tex: "\\sin" },
  { label: "কস", tex: "\\cos" },
  { label: "ট্যান", tex: "\\tan" },
  { label: "লগ", tex: "\\log" },
];

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  /** Use single-line input instead of textarea */
  singleLine?: boolean;
  className?: string;
}

export default function MathInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  singleLine = false,
  className = "",
}: MathInputProps) {
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const insertSymbol = (tex: string) => {
    const el = inputRef.current;
    if (!el) {
      onChange(value + `$${tex}$`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    // Check if cursor is already inside $...$
    const dollarsBefore = (before.match(/\$/g) || []).length;
    const insert = dollarsBefore % 2 === 1 ? tex : `$${tex}$`;
    const newVal = before + insert + after;
    onChange(newVal);
    // Restore focus
    setTimeout(() => {
      el.focus();
      const pos = start + insert.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs px-2">
              <Sigma className="w-3.5 h-3.5" />
              গণিত সিম্বল
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <p className="text-xs text-muted-foreground mb-2">ক্লিক করে ইনপুটে যোগ করুন</p>
            <div className="grid grid-cols-4 gap-1">
              {MATH_SYMBOLS.map((s) => (
                <Button
                  key={s.tex}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-mono justify-start px-1.5"
                  title={s.label}
                  onClick={() => insertSymbol(s.tex)}
                >
                  <LatexRenderer text={`$${s.tex}$`} />
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1.5 ml-auto">
          <Label htmlFor="math-preview" className="text-xs text-muted-foreground cursor-pointer">
            প্রিভিউ
          </Label>
          <Switch
            id="math-preview"
            checked={showPreview}
            onCheckedChange={setShowPreview}
            className="scale-75"
          />
        </div>
      </div>

      {singleLine ? (
        <Input
          ref={inputRef as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <Textarea
          ref={inputRef as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
        />
      )}

      {showPreview && value && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm min-h-[2rem]">
          <LatexRenderer text={value} />
        </div>
      )}
    </div>
  );
}
