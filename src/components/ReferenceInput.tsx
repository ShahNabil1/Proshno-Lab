import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

interface RefEntry {
  board?: string;
  name?: string;
  year: string;
}

interface ReferenceInputProps {
  label: string;
  nameLabel: string;
  namePlaceholder: string;
  value: RefEntry[];
  onChange: (refs: RefEntry[]) => void;
  nameKey: "board" | "name";
}

export default function ReferenceInput({ label, nameLabel, namePlaceholder, value, onChange, nameKey }: ReferenceInputProps) {
  const [draft, setDraft] = useState({ name: "", year: "" });

  const addRef = () => {
    if (!draft.name.trim() || !draft.year.trim()) return;
    onChange([...value, { [nameKey]: draft.name.trim(), year: draft.year.trim() } as any]);
    setDraft({ name: "", year: "" });
  };

  const removeRef = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{label}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((r, i) => (
            <Badge key={i} variant="secondary" className="gap-1 bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              {(r as any)[nameKey]} '{r.year}
              <button onClick={() => removeRef(i)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input placeholder={namePlaceholder} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="flex-1" />
        <Input placeholder="সাল (যেমন: ২০২৩)" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} className="w-32" />
        <Button type="button" size="icon" variant="outline" onClick={addRef}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
