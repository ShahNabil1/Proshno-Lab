import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortClasses } from "@/lib/classOrder";

export interface ClassPickerItem {
  id: number | string;
  name?: string | null;
}

interface ClassPickerProps {
  value?: string;
  classes: ClassPickerItem[];
  disabled?: boolean;
  placeholder?: string;
  triggerClassName?: string;
  triggerIcon?: "scan" | "chevron";
  onChange: (classId: string) => void;
}

export default function ClassPicker({
  value,
  classes,
  disabled = false,
  placeholder = "শ্রেণি সিলেক্ট করুন",
  triggerClassName,
  triggerIcon = "chevron",
  onChange,
}: ClassPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(value || "");

  // Sort classes in pedagogical order (একাদশ-দ্বাদশ, নবম-দশম, etc.)
  const orderedClasses = useMemo(() => sortClasses(classes), [classes]);

  const selectedClass = useMemo(() => {
    if (!value) return null;
    return classes.find((c) => String(c.id) === String(value)) || null;
  }, [value, classes]);

  // Sync selectedId when modal opens
  useEffect(() => {
    if (open) {
      setSelectedId(value || "");
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open, value]);

  const handleConfirm = () => {
    if (selectedId) {
      onChange(selectedId);
    }
    setOpen(false);
  };

  const handleSelectDirect = (clsId: string) => {
    setSelectedId(clsId);
    onChange(clsId);
  };

  const handleDoubleClick = (clsId: string) => {
    onChange(clsId);
    setOpen(false);
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
          !selectedClass && "text-slate-500",
          triggerClassName
        )}
        title={selectedClass?.name || placeholder}
      >
        <span className="truncate font-medium flex-1 min-w-0 py-1 px-0.5 leading-normal">
          {selectedClass?.name ? (
            <span className="text-slate-800 font-semibold">{selectedClass.name}</span>
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
            className="relative bg-white text-gray-900 rounded-[1px] shadow-2xl overflow-hidden w-full max-w-lg flex flex-col border border-slate-300 animate-in zoom-in-95 duration-200"
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100 border-b border-slate-200">
              <div className="text-base font-bold text-slate-800 font-bangla">
                শ্রেণি নির্বাচন করুন
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
              <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 border border-slate-300 rounded-[1px] bg-white">
                {orderedClasses.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500 font-bangla">
                    কোনো শ্রেণি পাওয়া যায়নি
                  </p>
                ) : (
                  orderedClasses.map((cls) => {
                    const clsId = String(cls.id);
                    const isSelected = selectedId === clsId;

                    return (
                      <div
                        key={cls.id}
                        onClick={() => handleSelectDirect(clsId)}
                        onDoubleClick={() => handleDoubleClick(clsId)}
                        className={cn(
                          "flex items-center px-3.5 py-3 transition-colors cursor-pointer select-none",
                          isSelected
                            ? "bg-[#0A1E38]/5 hover:bg-[#0A1E38]/10"
                            : "hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="radio"
                          id={`class-radio-${cls.id}`}
                          name="class-radio-select"
                          checked={isSelected}
                          onChange={() => handleSelectDirect(clsId)}
                          className="h-4 w-4 border-slate-300 text-[#0A1E38] focus:ring-[#0A1E38] cursor-pointer accent-[#0A1E38]"
                        />
                        <label
                          htmlFor={`class-radio-${cls.id}`}
                          className="pl-3 w-full py-0.5 cursor-pointer text-base text-slate-800 flex items-center justify-between select-none pointer-events-none"
                        >
                          <span
                            className={cn(
                              isSelected
                                ? "font-bold text-[#0A1E38]"
                                : "font-medium text-slate-800"
                            )}
                          >
                            {cls.name}
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
                  onClick={handleConfirm}
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
