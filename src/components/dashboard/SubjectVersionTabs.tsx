import { cn } from "@/lib/utils";
import type { SubjectVersion } from "@/lib/subjectVersion";

interface SubjectVersionTabsProps {
  value: SubjectVersion;
  onChange: (value: SubjectVersion) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: SubjectVersion; label: string }> = [
  { value: "bangla", label: "বাংলা ভার্সন" },
  { value: "english", label: "English Version" },
  { value: "all", label: "সবগুলো" },
];

export default function SubjectVersionTabs({ value, onChange, disabled }: SubjectVersionTabsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5",
        disabled && "pointer-events-none opacity-50",
      )}
      role="tablist"
      aria-label="বিষয়ের ভার্সন"
    >
      {OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
              "rounded-full border px-4 py-1 text-sm font-medium transition-all duration-150 cursor-pointer select-none",
              isActive
                ? "border-[#1E3577] bg-[#1E3577] text-white shadow-sm shadow-[#1E3577]/25 font-semibold"
                : "border-slate-200 bg-white text-slate-700 hover:border-[#1E3577]/40 hover:text-[#1E3577] hover:bg-slate-50",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
