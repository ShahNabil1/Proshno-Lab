import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PROGRAM_NAME_SUGGESTIONS, getProgramNameSuggestion } from "@/lib/programNameSuggestions";

interface ProgramNameSuggestionsProps {
  value: string;
  isEnglishVersion: boolean;
  onChange: (name: string) => void;
  id?: string;
  placeholder?: string;
}

export default function ProgramNameSuggestions({
  value,
  isEnglishVersion,
  onChange,
  id,
  placeholder = "প্রোগ্রাম/পরীক্ষার নাম",
}: ProgramNameSuggestionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[min(520px,calc(100vw-2rem))] p-2"
        aria-label="প্রোগ্রাম বা পরীক্ষার নামের সাজেশন"
      >
        <p className="px-2 pb-1.5 text-xs text-muted-foreground">একটি নাম সিলেক্ট করুন অথবা নিজের নাম লিখুন</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {PROGRAM_NAME_SUGGESTIONS.map((suggestion) => {
            const name = getProgramNameSuggestion(suggestion, isEnglishVersion);
            return (
              <button
                key={suggestion.english}
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className="rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {name}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
