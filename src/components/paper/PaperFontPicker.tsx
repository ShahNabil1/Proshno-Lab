import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UNICODE_PAPER_FONTS } from "@/lib/paperFonts";
import { ENGLISH_PAPER_FONTS } from "@/lib/englishPaperFonts";

const defaults = [
  { id: "bangla", label: "সোলাইমান লিপি", family: "SolaimanLipi" },
  { id: "kalpurush", label: "কালপুরুষ", family: "Kalpurush" },
  { id: "omicronbangla", label: "Bangla — OmicronLab", family: "OmicronBangla" },
];
const english = new Set<string>(ENGLISH_PAPER_FONTS.map(f => f.id));
const standard = new Set(["hind-siliguri", "anek-bangla", "li-ador-noirrit"]);
const groups = [
  { title: "বাংলা — স্ট্যান্ডার্ড", sample: "পরীক্ষার প্রশ্নপত্র", fonts: [...defaults, ...UNICODE_PAPER_FONTS.filter(f => standard.has(f.id))] },
  { title: "অন্যান্য বাংলা ফন্ট", sample: "পরীক্ষার প্রশ্নপত্র", fonts: UNICODE_PAPER_FONTS.filter(f => !english.has(f.id) && !standard.has(f.id)) },
  { title: "English fonts", sample: "Examination Paper", fonts: [
    { id: "timesnewroman", label: "Times New Roman", family: "Times New Roman" },
    { id: "arial", label: "Arial", family: "Arial" },
    { id: "georgia", label: "Georgia", family: "Georgia" },
    ...ENGLISH_PAPER_FONTS,
  ] },
];

export default function PaperFontPicker({ value, onChange, familyValue = false, label = "ফন্ট নির্বাচন করুন" }: {
  value: string; onChange: (value: string) => void; familyValue?: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const key = (font: { id: string; family: string }) => familyValue ? font.family : font.id;
  const availableGroups = groups.map((g, i) => ({ ...g, fonts: familyValue && i === 0
    ? [...g.fonts, { id: "noto-serif-bengali", label: "নোটো সেরিফ বাংলা", family: "Noto Serif Bengali" }] : g.fonts }));
  const selected = availableGroups.flatMap(g => g.fonts).find(f => key(f) === (value === "solaimanlipi" ? "bangla" : value));
  const filtered = availableGroups.map(g => ({ ...g, fonts: g.fonts.filter(f => `${f.label} ${f.family}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) }));
  return <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(""); }}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" aria-label={label} className="mt-1 w-full justify-between gap-2 font-normal">
        <span className="truncate">{selected?.label || (value === "inherit" ? "ডিফল্ট" : value)}</span><ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>
    </DialogTrigger>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
      <DialogHeader className="shrink-0 border-b px-5 pb-4 pt-5 text-left">
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>নমুনা দেখে একটি ফন্ট বেছে নিন। বাংলা ফন্ট উপরে, English ফন্ট নিচে।</DialogDescription>
        <div className="relative pt-3"><Search className="absolute left-3 top-[22px] h-4 w-4 text-muted-foreground" /><Input aria-label="ফন্ট খুঁজুন" placeholder="ফন্টের নাম লিখে খুঁজুন…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      </DialogHeader>
      <div className="min-h-0 overflow-y-auto p-5">
        {familyValue && <Button type="button" variant={value === "inherit" ? "default" : "outline"} className="mb-5" onClick={() => { onChange("inherit"); setOpen(false); setSearch(""); }}>ডিফল্ট ফন্ট</Button>}
        {filtered.map(group => group.fonts.length > 0 && <section key={group.title} className="mb-6 last:mb-0" aria-label={group.title}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{group.title}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {group.fonts.map(font => {
              const active = selected?.id === font.id;
              return <button type="button" key={font.id} aria-pressed={active} aria-label={font.label} onClick={() => { onChange(key(font)); setOpen(false); setSearch(""); }}
                className={`relative min-w-0 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/50 hover:bg-muted/40"}`}>
                {active && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
                <span className="mb-3 block truncate pr-4 text-xs text-muted-foreground">{font.label}</span>
                <span className="block truncate text-xl leading-relaxed text-foreground" style={{ fontFamily: `"${font.family}", SolaimanLipi, serif` }}>{group.sample}</span>
              </button>;
            })}
          </div>
        </section>)}
        {!filtered.some(g => g.fonts.length) && <p className="py-10 text-center text-sm text-muted-foreground">এই নামে কোনো ফন্ট পাওয়া যায়নি।</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
