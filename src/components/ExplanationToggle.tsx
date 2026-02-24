import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import LatexRenderer from "@/components/LatexRenderer";

interface ExplanationToggleProps {
  explanation: string | null | undefined;
}

export default function ExplanationToggle({ explanation }: ExplanationToggleProps) {
  const [open, setOpen] = useState(false);

  if (!explanation?.trim()) return null;

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-400 dark:bg-emerald-950 dark:hover:bg-emerald-900"
      >
        <BookOpen className="w-4 h-4" />
        {open ? "ব্যাখ্যা বন্ধ করুন" : "ব্যাখ্যা দেখুন"}
      </Button>
      {open && (
        <div className="mt-2 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-sm text-foreground">
          <LatexRenderer text={explanation} />
        </div>
      )}
    </div>
  );
}
