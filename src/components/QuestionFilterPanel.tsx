import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Filter, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FilterPanelProps {
  onSearch?: (term: string) => void;
}

const classes = ["৬ষ্ঠ", "৭ম", "৮ম", "৯ম", "১০ম", "একাদশ", "দ্বাদশ"];
const subjects = ["বাংলা", "ইংরেজি", "গণিত", "পদার্থবিজ্ঞান", "রসায়ন", "জীববিজ্ঞান", "ইতিহাস"];

export default function QuestionFilterPanel({ onSearch }: FilterPanelProps) {
  const [search, setSearch] = useState("");
  const [showMobile, setShowMobile] = useState(false);

  const filterContent = (
    <div className="space-y-4">
      <div>
        <Label>শ্রেণি</Label>
        <Select>
          <SelectTrigger><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>
            {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>বিষয়</Label>
        <Select>
          <SelectTrigger><SelectValue placeholder="বিষয় নির্বাচন করুন" /></SelectTrigger>
          <SelectContent>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>অধ্যায়</Label>
        <Input placeholder="অধ্যায় লিখুন" />
      </div>
      <div>
        <Label>বছর</Label>
        <Input placeholder="যেমন: ২০২৪" />
      </div>
      <Button className="w-full font-heading" size="sm">
        <Filter className="w-4 h-4 mr-1.5" /> ফিল্টার করুন
      </Button>
    </div>
  );

  return (
    <>
      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="প্রশ্ন অনুসন্ধান করুন..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); onSearch?.(e.target.value); }}
          />
        </div>
        <Button variant="outline" className="lg:hidden" onClick={() => setShowMobile(!showMobile)}>
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Desktop sidebar filter */}
      <div className="hidden lg:block bg-card rounded-xl shadow-sm p-5">
        <h3 className="font-heading font-bold text-foreground mb-4">ফিল্টার</h3>
        {filterContent}
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {showMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/30 lg:hidden"
            onClick={() => setShowMobile(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-card p-6 overflow-y-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading font-bold text-foreground">ফিল্টার</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowMobile(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {filterContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
