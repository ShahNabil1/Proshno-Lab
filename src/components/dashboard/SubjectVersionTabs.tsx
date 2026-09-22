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
        "flex flex-wrap items-center justify-center gap-1.5 rounded-[1px] border border-slate-300 bg-slate-100 p-1",
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
              "rounded-[1px] border px-4 py-1.5 text-sm transition-all duration-150 cursor-pointer select-none",
              isActive
                ? "border-[#0A1E38] bg-[#0A1E38] text-white shadow-xs font-bold"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium",
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
