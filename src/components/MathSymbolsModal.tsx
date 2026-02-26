import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import LatexRenderer from "@/components/LatexRenderer";

const CATEGORIES = {
  basic: {
    label: "বেসিক",
    symbols: [
      { label: "ভগ্নাংশ", tex: "\\frac{a}{b}" },
      { label: "বর্গমূল", tex: "\\sqrt{x}" },
      { label: "n-তম মূল", tex: "\\sqrt[n]{x}" },
      { label: "সুপারস্ক্রিপ্ট", tex: "x^{2}" },
      { label: "সাবস্ক্রিপ্ট", tex: "x_{i}" },
      { label: "যোগ", tex: "+" },
      { label: "বিয়োগ", tex: "-" },
      { label: "গুণ", tex: "\\times" },
      { label: "ভাগ", tex: "\\div" },
      { label: "নট ইকুয়াল", tex: "\\neq" },
      { label: "প্লাস-মাইনাস", tex: "\\pm" },
      { label: "লেস/ইকুয়াল", tex: "\\leq" },
      { label: "গ্রেটার/ইকুয়াল", tex: "\\geq" },
      { label: "ডিগ্রী", tex: "^\\circ" },
      { label: "ইনফিনিটি", tex: "\\infty" },
    ],
  },
  greek: {
    label: "গ্রিক",
    symbols: [
      { label: "আলফা", tex: "\\alpha" },
      { label: "বিটা", tex: "\\beta" },
      { label: "গামা", tex: "\\gamma" },
      { label: "থিটা", tex: "\\theta" },
      { label: "পাই", tex: "\\pi" },
      { label: "ডেল্টা", tex: "\\Delta" },
      { label: "ওমেগা", tex: "\\Omega" },
      { label: "ল্যাম্বডা", tex: "\\lambda" },
      { label: "মিউ", tex: "\\mu" },
      { label: "সিগমা", tex: "\\sigma" },
      { label: "ইপসিলন", tex: "\\epsilon" },
      { label: "ফাই", tex: "\\phi" },
      { label: "রো", tex: "\\rho" },
      { label: "এটা", tex: "\\eta" },
      { label: "কাপা", tex: "\\kappa" },
    ],
  },
  calculus: {
    label: "ক্যালকুলাস/সেট",
    symbols: [
      { label: "সমাকলন", tex: "\\int_{a}^{b}" },
      { label: "সিগমা", tex: "\\sum_{i=1}^{n}" },
      { label: "লিমিট", tex: "\\lim_{x \\to a}" },
      { label: "ডেরিভেটিভ", tex: "\\frac{d}{dx}" },
      { label: "পার্শিয়াল", tex: "\\frac{\\partial}{\\partial x}" },
      { label: "ইউনিয়ন", tex: "\\cup" },
      { label: "ইন্টারসেকশন", tex: "\\cap" },
      { label: "ইলিমেন্ট অফ", tex: "\\in" },
      { label: "সাবসেট", tex: "\\subset" },
      { label: "ইমপ্লাইজ", tex: "\\implies" },
      { label: "ফর অল", tex: "\\forall" },
      { label: "এক্সিস্টস", tex: "\\exists" },
      { label: "প্রোডাক্ট", tex: "\\prod_{i=1}^{n}" },
      { label: "নট ইন", tex: "\\notin" },
    ],
  },
  trig: {
    label: "ত্রিকোণমিতি",
    symbols: [
      { label: "সাইন", tex: "\\sin" },
      { label: "কস", tex: "\\cos" },
      { label: "ট্যান", tex: "\\tan" },
      { label: "কট", tex: "\\cot" },
      { label: "সেক", tex: "\\sec" },
      { label: "কসেক", tex: "\\csc" },
      { label: "ইনভার্স সাইন", tex: "\\sin^{-1}" },
      { label: "ইনভার্স কস", tex: "\\cos^{-1}" },
      { label: "ইনভার্স ট্যান", tex: "\\tan^{-1}" },
      { label: "লগ", tex: "\\log" },
      { label: "ন্যাচারাল লগ", tex: "\\ln" },
    ],
  },
  physics: {
    label: "পদার্থবিজ্ঞান",
    symbols: [
      { label: "ভেক্টর", tex: "\\vec{A}" },
      { label: "ডট প্রোডাক্ট", tex: "\\cdot" },
      { label: "ক্রস প্রোডাক্ট", tex: "\\times" },
      { label: "হ্যাট ভেক্টর", tex: "\\hat{i}" },
      { label: "নাবলা", tex: "\\nabla" },
      { label: "ডেল্টা", tex: "\\Delta" },
      { label: "ওভারলাইন", tex: "\\overline{AB}" },
      { label: "অ্যাঙ্গেল", tex: "\\angle" },
      { label: "প্যারালেল", tex: "\\parallel" },
      { label: "পার্পেন্ডিকুলার", tex: "\\perp" },
      { label: "অ্যাপ্রক্স", tex: "\\approx" },
      { label: "প্রোপোরশনাল", tex: "\\propto" },
    ],
  },
  templates: {
    label: "টেমপ্লেট",
    symbols: [
      { label: "দ্বিঘাত সূত্র", tex: "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" },
      { label: "2×2 ম্যাট্রিক্স", tex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
      { label: "3×3 ম্যাট্রিক্স", tex: "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}" },
      { label: "নির্ণায়ক", tex: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}" },
      { label: "পিস-ওয়াইজ", tex: "\\begin{cases} x & \\text{if } x>0 \\\\ -x & \\text{if } x<0 \\end{cases}" },
      { label: "বাইনমিয়াল", tex: "\\binom{n}{r}" },
    ],
  },
};

interface MathSymbolsModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
}

export default function MathSymbolsModal({ open, onClose, onInsert }: MathSymbolsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">গাণিতিক চিহ্ন সন্নিবেশ</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-0.5 bg-muted/50 p-1">
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <TabsTrigger key={key} value={key} className="text-[11px] px-2 py-1 h-7 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <TabsContent key={key} value={key} className="mt-2 max-h-52 overflow-y-auto">
              <div className={key === "templates" ? "grid grid-cols-2 gap-1" : "grid grid-cols-4 gap-1"}>
                {cat.symbols.map((s) => (
                  <Button
                    key={s.tex + s.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-mono justify-start px-1.5"
                    title={s.label}
                    onClick={() => {
                      onInsert(s.tex);
                      onClose();
                    }}
                  >
                    <span className="truncate">
                      <LatexRenderer text={`$${s.tex}$`} />
                    </span>
                  </Button>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
