import { Sparkles, FileEdit, PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreateMode = "auto" | "manual" | "ready";

interface Props {
  mode: CreateMode;
  onChange: (m: CreateMode) => void;
}

const items: { id: CreateMode; label: string; icon: React.ElementType }[] = [
  { id: "auto", label: "অটো প্রশ্ন তৈরী", icon: Sparkles },
  { id: "manual", label: "প্রশ্ন তৈরি", icon: FileEdit },
  { id: "ready", label: "রেডি প্রশ্ন", icon: PackageCheck },
];

export default function CreateModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6">
      {items.map(({ id, label, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-full text-sm font-medium border transition-all",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                : "bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
