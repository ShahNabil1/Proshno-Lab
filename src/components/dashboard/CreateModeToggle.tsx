import { SlidersHorizontal, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreateMode = "manual" | "auto";

interface Props {
  mode: CreateMode;
  onChange: (m: CreateMode) => void;
}

const items: {
  id: CreateMode;
  label: string;
  icon: React.ElementType;
}[] = [
  {
    id: "manual",
    label: "প্রশ্ন তৈরি",
    icon: FileEdit,
  },  {
    id: "auto",
    label: "১ ক্লিকে অটো প্রশ্ন",
    icon: SlidersHorizontal,
  },

];

export default function CreateModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mx-auto max-w-5xl mb-4">
      <div className="create-mode-switch grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 border border-slate-200">
        {items.map(({ id, label, icon: Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={cn(
                "relative min-w-0 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-2 sm:px-4 py-3 rounded-xl text-base transition-all duration-150 select-none border cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00858c]",
                active
                  ? "bg-[#0A1E38] border-[#0A1E38] text-white shadow-sm font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-white/70"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0",
                  active
                    ? "bg-white text-[#0A1E38]"
                    : "bg-[#0A1E38] text-white"
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="text-center sm:text-left leading-snug">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-sm sm:text-base", active ? "text-white font-bold" : "text-slate-700 font-medium")}>
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
