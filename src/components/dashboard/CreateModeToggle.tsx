import { SlidersHorizontal, FileEdit, PackageCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreateMode = "manual" | "auto" | "ready";

interface Props {
  mode: CreateMode;
  onChange: (m: CreateMode) => void;
}

const items: {
  id: CreateMode;
  label: string;
  badge?: string;
  icon: React.ElementType;
}[] = [
  {
    id: "auto",
    label: "১ ক্লিকে অটো প্রশ্ন",
    badge: "১ ক্লিকে",
    icon: SlidersHorizontal,
  },
  {
    id: "manual",
    label: "প্রশ্ন তৈরি (কাস্টম বাছাই)",
    icon: FileEdit,
  },
  {
    id: "ready",
    label: "রেডি প্রশ্নব্যাংক",
    icon: PackageCheck,
  },
];

export default function CreateModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mx-auto max-w-5xl mb-6">
      <div className="create-mode-switch grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2 border border-slate-200">
        {items.map(({ id, label, badge, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "relative flex items-center justify-center gap-3 px-3 sm:px-4 py-3.5 rounded-xl text-base transition-all duration-150 select-none shrink-0 border cursor-pointer",
                active
                  ? "bg-[#0A1E38] border-[#0A1E38] text-white shadow-sm font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 border",
                  active
                    ? "bg-[#00B4BC]/15 text-[#27D3DB] border-[#00B4BC]/20"
                    : "bg-slate-200/70 text-slate-500 border-slate-300/40"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="text-left leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-base", active ? "text-white font-bold" : "text-slate-700 font-medium")}>
                    {label}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
