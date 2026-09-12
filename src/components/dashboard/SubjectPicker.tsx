import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
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
  onChange: (subjectId: string, subjectIds: string[]) => void;
  onVersionChange: (version: SubjectVersion) => void;
}

export default function SubjectPicker<T extends VersionedSubject>({
  value,
  values,
  subjects,
  classes,
  version,
  disabled,
  placeholder = "বিষয় সিলেক্ট করুন",
  onChange,
  onVersionChange,
}: SubjectPickerProps<T>) {
  const [open, setOpen] = useState(false);

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
      .map((id) => subjects.find((s) => String(s.id) === id)?.name)
      .filter(Boolean) as string[];
  }, [selectedIds, subjects]);

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
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-[#1E3577] focus:ring-offset-2 hover:border-[#1E3577]/50",
          disabled && "cursor-not-allowed opacity-50 pointer-events-none",
          selectedSubjectNames.length === 0 && "text-muted-foreground",
        )}
        title={selectedSubjectNames.length > 0 ? selectedSubjectNames.join(", ") : placeholder}
      >
        <span className="truncate font-medium">
          {selectedSubjectNames.length > 0 ? (
            <span className="text-foreground">
              {selectedSubjectNames.join(", ")}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white text-gray-900 rounded-xl shadow-2xl overflow-hidden w-full max-w-xl flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200"
          >
            {/* macOS Window Header Bar styled with brand logo identity */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/90 border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-3.5 w-3.5 rounded-full bg-[#ff5f56] hover:brightness-90 transition-colors cursor-pointer"
                  title="Close"
                  aria-label="Close"
                />
                <span className="h-3.5 w-3.5 rounded-full bg-[#ffbd2e] cursor-default" title="Minimize" />
                <span className="h-3.5 w-3.5 rounded-full bg-[#27c93f] cursor-default" title="Maximize" />
              </div>
              <div className="text-sm font-semibold text-[#1E3577] font-bangla">
                বিষয় সিলেক্ট করুন
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              {/* Version Tabs: বাংলা ভার্সন (default), English Version, সবগুলো */}
              <SubjectVersionTabs value={version} onChange={onVersionChange} />

              {/* Subjects List */}
              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                {subjects.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500 font-bangla">
                    এই ভার্সনে কোনো বিষয় যোগ করা হয়নি
                  </p>
                ) : (
                  subjects.map((subject) => {
                    const subjectId = String(subject.id);
                    const isChecked = selectedIds.includes(subjectId);
                    return (
                      <div
                        key={subject.id}
                        onClick={() => handleToggle(subjectId)}
                        className={cn(
                          "flex items-center px-3 py-1.5 transition-colors cursor-pointer select-none",
                          isChecked
                            ? "bg-[#1E3577]/[0.05] hover:bg-[#1E3577]/[0.08]"
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
                          className="h-4 w-4 rounded border-slate-300 text-[#1E3577] focus:ring-[#1E3577] cursor-pointer accent-[#1E3577]"
                        />
                        <label
                          htmlFor={`subject-checkbox-${subject.id}`}
                          className="pl-3 w-full py-1 cursor-pointer text-sm text-slate-800 flex items-center justify-between select-none pointer-events-none"
                        >
                          <span className={cn(isChecked ? "font-bold text-[#1E3577]" : "font-normal text-slate-800")}>
                            {subject.name}
                          </span>
                          <Star
                            className={cn(
                              "h-4 w-4 shrink-0 ml-2 fill-[#F4C053] text-[#F4C053] transition-transform",
                              isChecked && "scale-110 drop-shadow-sm"
                            )}
                          />
                        </label>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer Buttons with Brand Colors */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 bg-[#1E3577] hover:bg-[#162758] text-white font-semibold py-2 px-4 rounded-md text-sm transition-all text-center shadow-sm hover:shadow active:scale-[0.99] cursor-pointer"
                >
                  সিলেক্ট করুন
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-md text-sm transition-colors text-center border border-slate-200 cursor-pointer"
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
