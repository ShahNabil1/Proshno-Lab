import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortSubjects } from "@/lib/classOrder";
import SubjectVersionTabs from "@/components/dashboard/SubjectVersionTabs";
import type {
  SubjectVersion,
  VersionedClass,
  VersionedSubject,
} from "@/lib/subjectVersion";

interface SubjectPickerProps<T extends VersionedSubject> {
  value?: string;
  values?: string[];
  subjects: T[];
  classes: VersionedClass[];
  version: SubjectVersion;
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
  triggerIcon?: "scan" | "chevron";
  onChange: (subjectId: string, subjectIds: string[]) => void;
  onVersionChange: (version: SubjectVersion) => void;
}

export default function SubjectPicker<T extends VersionedSubject>({
  value,
  values,
  subjects,
  version,
  disabled,
  placeholder = "বিষয় সিলেক্ট করুন",
  triggerClassName,
  triggerIcon = "scan",
  onChange,
  onVersionChange,
}: SubjectPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const orderedSubjects = useMemo(() => sortSubjects(subjects), [subjects]);

  // Normalize selected IDs from props
  const selectedIds = useMemo(() => {
    if (values && Array.isArray(values)) return values.map(String);
    if (value) return value.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  }, [value, values]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  // Names of selected subjects for display in the trigger
  const selectedSubjectNames = useMemo(() => {
    return selectedIds
      .map((id) => orderedSubjects.find((s) => String(s.id) === id)?.name)
      .filter(Boolean) as string[];
  }, [selectedIds, orderedSubjects]);

  const handleToggle = (id: string) => {
    const nextIds = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    onChange(nextIds[0] || "", nextIds);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-[1px] border border-slate-300 bg-white px-3.5 py-1 text-base cursor-pointer transition-colors text-slate-800",
          "focus:outline-none focus:ring-1 focus:ring-[#0A1E38] hover:border-slate-400",
          disabled && "cursor-not-allowed opacity-50 pointer-events-none bg-slate-50",
          selectedSubjectNames.length === 0 && "text-slate-500",
          triggerClassName
        )}
        title={selectedSubjectNames.length > 0 ? selectedSubjectNames.join(", ") : placeholder}
      >
        <span className="truncate font-medium flex-1 min-w-0 py-1 px-0.5 leading-normal">
          {selectedSubjectNames.length > 0 ? (
            <span className="text-slate-800 font-semibold">
              {selectedSubjectNames.join(", ")}
            </span>
          ) : (
            placeholder
          )}
        </span>
        {triggerIcon === "scan" ? (
          <Scan className="h-4 w-4 shrink-0 text-slate-500 ml-2" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white text-gray-900 rounded-[1px] shadow-2xl overflow-hidden w-full max-w-xl flex flex-col border border-slate-300 animate-in zoom-in-95 duration-200"
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100 border-b border-slate-200">
              <div className="text-base font-bold text-slate-800 font-bangla">
                বিষয় নির্বাচন করুন
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-2.5 py-1 rounded-[1px] bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors cursor-pointer"
              >
                ✕ বন্ধ
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              {/* Version Tabs: বাংলা ভার্সন (default), English Version, সবগুলো */}
              <SubjectVersionTabs value={version} onChange={onVersionChange} />

              {/* Subjects List */}
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 border border-slate-300 rounded-[1px] bg-white">
                {orderedSubjects.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500 font-bangla">
                    এই ভার্সনে কোনো বিষয় যোগ করা হয়নি
                  </p>
                ) : (
                  orderedSubjects.map((subject) => {
                    const subjectId = String(subject.id);
                    const isChecked = selectedIds.includes(subjectId);

                    return (
                      <div
                        key={subject.id}
                        onClick={() => handleToggle(subjectId)}
                        className={cn(
                          "flex items-center px-3.5 py-2.5 transition-colors cursor-pointer select-none",
                          isChecked
                            ? "bg-[#0A1E38]/5 hover:bg-[#0A1E38]/10"
                            : "hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          id={`subject-checkbox-${subject.id}`}
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggle(subjectId);
                          }}
                          className="h-4 w-4 rounded-[1px] border-slate-300 text-[#0A1E38] focus:ring-[#0A1E38] cursor-pointer accent-[#0A1E38]"
                        />
                        <label
                          htmlFor={`subject-checkbox-${subject.id}`}
                          className="pl-3 w-full py-1 cursor-pointer text-base text-slate-800 flex items-center justify-between select-none pointer-events-none"
                        >
                          <span className={cn(isChecked ? "font-bold text-[#0A1E38]" : "font-normal text-slate-800")}>
                            {subject.name}
                          </span>

                        </label>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 bg-[#0A1E38] hover:bg-[#122B4D] text-white font-bold py-2.5 px-4 rounded-[1px] text-base transition-colors text-center shadow-xs cursor-pointer border border-[#0A1E38]"
                >
                  সিলেক্ট করুন
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-[1px] text-base transition-colors text-center border border-slate-300 cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
