import { useEffect, useState } from "react";
import { Scan, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface PackagePickerOption { id: string; label: string; detail?: string; disabled?: boolean }
interface Props {
  title: string;
  label: string;
  placeholder: string;
  options: PackagePickerOption[];
  selected: string[];
  multiple?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  onSelect: (id: string) => void;
}

export default function PackagePicker({ title, label, placeholder, options, selected, multiple=false, disabled=false, searchable=false, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => { if (!open) setSearch(""); }, [open]);
  const chosen = options.filter(o => selected.includes(o.id));
  const visible = options.filter(o => o.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const display = chosen.length ? multiple ? `${chosen.length.toLocaleString("bn-BD")}টি বিষয় নির্বাচিত` : chosen[0].label : placeholder;
  return <div className="min-w-0 space-y-1.5">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <Button aria-label={placeholder} type="button" variant="outline" disabled={disabled} className="h-12 w-full justify-between rounded-lg border-slate-200 bg-white px-3.5 text-base font-normal text-slate-800 hover:border-slate-400" onClick={() => setOpen(true)}>
      <span className="truncate">{display}</span><Scan className="ml-2 h-4 w-4 shrink-0 text-slate-500" />
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%_-_24px)] max-w-xl flex-col gap-0 overflow-hidden rounded-xl p-0">
        <DialogHeader className="shrink-0 border-b bg-slate-50 p-5 text-left"><DialogTitle className="pr-7 font-heading text-[#0A1E38]">{title}</DialogTitle><DialogDescription>{multiple ? "আপনার প্রয়োজনের এক বা একাধিক বিষয় বেছে নিন।" : "একটি অপশন বেছে নিন।"}</DialogDescription></DialogHeader>
        {searchable && <div className="relative mx-4 mt-4 shrink-0"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input aria-label="বিষয় খুঁজুন" placeholder="বিষয় খুঁজুন…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>}
        <div className="min-h-0 overflow-y-auto p-4 overscroll-contain">
          <div className="divide-y rounded-lg border border-slate-200">{visible.map(o => <label key={o.id} className={`flex min-h-12 items-center gap-3 p-3.5 ${o.disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : "cursor-pointer hover:bg-slate-50"} ${selected.includes(o.id) ? "bg-[#00B4BC]/5" : ""}`}>
            <input type={multiple ? "checkbox" : "radio"} name={title} aria-label={o.label} className="h-4 w-4 shrink-0 accent-[#0A1E38]" disabled={o.disabled} checked={selected.includes(o.id)} onChange={() => { onSelect(o.id); if (!multiple) setOpen(false); }} />
            <span className="min-w-0 flex-1 break-words text-sm font-medium">{o.label}</span>{o.detail && <span className="shrink-0 text-xs text-slate-500">{o.detail}</span>}
          </label>)}</div>
          {!visible.length && <p className="py-8 text-center text-sm text-muted-foreground">কোনো অপশন পাওয়া যায়নি।</p>}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t bg-slate-50 p-4"><span className="text-sm text-slate-500">{multiple ? `${selected.length.toLocaleString("bn-BD")}টি নির্বাচিত` : ""}</span><Button className="bg-[#0A1E38] hover:bg-[#152e52]" onClick={() => setOpen(false)}>সম্পন্ন</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
