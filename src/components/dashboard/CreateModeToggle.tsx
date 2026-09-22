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
  sublabel: string;
  badge?: string;
  icon: React.ElementType;
}[] = [
  {
    id: "auto",
    label: "১ ক্লিকে অটো প্রশ্ন",
    sublabel: "ইনস্ট্যান্ট প্রশ্ন জেনারেটর",
    badge: "১ ক্লিকে",
    icon: SlidersHorizontal,
  },
  {
    id: "manual",
    label: "প্রশ্ন তৈরি (কাস্টম বাছাই)",
    sublabel: "বোর্ড ও স্কুল প্রশ্ন ফিল্টার",
    icon: FileEdit,
  },
  {
    id: "ready",
    label: "রেডি প্রশ্নব্যাংক",
    sublabel: "মডেল টেস্ট ও প্রশ্ন প্যাকেজ",
    icon: PackageCheck,
  },
];

export default function CreateModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex flex-col items-center mb-5">
      <div className="inline-flex p-1 rounded-[1px] bg-slate-100 border border-slate-300 max-w-full overflow-x-auto gap-1 shadow-xs">
        {items.map(({ id, label, sublabel, badge, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "relative flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-[1px] text-sm transition-all duration-150 select-none shrink-0 border cursor-pointer",
                active
                  ? "bg-white border-[#0A1E38] text-slate-900 shadow-xs font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-[1px] flex items-center justify-center transition-colors shrink-0 border",
                  active
                    ? "bg-[#0A1E38] text-white border-[#0A1E38]"
                    : "bg-slate-200/70 text-slate-500 border-slate-300/40"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="text-left leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-sm", active ? "text-slate-900 font-bold" : "text-slate-700 font-medium")}>
                    {label}
                  </span>
                  {badge && active && (
                    <span className="hidden md:inline-block text-[10px] bg-slate-100 text-[#0A1E38] border border-slate-300 px-1.5 py-0.5 rounded-[1px] font-bold">
                      {badge}
                    </span>
                  )}
                </div>
                <span className={cn("hidden sm:block text-[11px] font-normal mt-0.5", active ? "text-slate-600" : "text-slate-400")}>
                  {sublabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
