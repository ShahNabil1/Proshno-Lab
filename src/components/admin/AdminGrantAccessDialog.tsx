import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_SUBJECTS_LABEL, normalizeSubscriptionText, resolvePlanClasses } from "@/lib/subscriptionMatcher";
import { sortClasses } from "@/lib/classOrder";
import { toast } from "sonner";
import { Banknote, CalendarPlus, CheckCircle2, Loader2, Search, UserCheck, X } from "lucide-react";

interface TeacherOption { id: string; full_name: string; email: string; }
interface ClassRow { id: number; name: string; }
interface SubjectRow { id: number; class_id: number; name: string; }
interface PackageRow { id: number; class_name: string; subject_name: string; price: number; }

const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const errorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const message = String((err as { message?: unknown }).message || "");
    if (message) return message;
  }
  return fallback;
};

const addMonths = (base: Date, months: number) => {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
};

const DURATIONS = [
  { label: "১ মাস", months: 1 },
  { label: "৩ মাস", months: 3 },
  { label: "৬ মাস", months: 6 },
  { label: "১ বছর", months: 12 },
];

const sameLabel = (a: string, b: string) =>
  normalizeSubscriptionText(a) === normalizeSubscriptionText(b);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGranted?: () => void;
}

export default function AdminGrantAccessDialog({ open, onOpenChange, onGranted }: Props) {
  const [term, setTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TeacherOption[]>([]);
  const [customer, setCustomer] = useState<TeacherOption | null>(null);

  const [mode, setMode] = useState<"package" | "custom">("package");
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [packageId, setPackageId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);

  const [startsAt, setStartsAt] = useState(toDateInput(new Date()));
  const [endsAt, setEndsAt] = useState(toDateInput(addMonths(new Date(), 12)));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTerm(""); setResults([]); setCustomer(null);
    setMode("package"); setPackageId(""); setClassId(""); setSubjectIds([]);
    setAmount(""); setNote("");
    setStartsAt(toDateInput(new Date()));
    setEndsAt(toDateInput(addMonths(new Date(), 12)));

    Promise.all([
      supabase.from("pricing_packages").select("id, class_name, subject_name, price").eq("is_active", true).order("sort_order"),
      supabase.from("classes").select("id, name"),
      supabase.from("subjects").select("id, class_id, name"),
    ]).then(([pkgRes, classRes, subRes]) => {
      setPackages((pkgRes.data as PackageRow[]) || []);
      setClasses(sortClasses((classRes.data as ClassRow[]) || []));
      setSubjects((subRes.data as SubjectRow[]) || []);
    });
  }, [open]);

  useEffect(() => {
    const q = term.trim().replace(/[,()*%]/g, " ");
    if (q.length < 3) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("teachers")
        .select("id, full_name, email")
        .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(8);
      if (cancelled) return;
      setResults((data as TeacherOption[]) || []);
      setSearching(false);
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); setSearching(false); };
  }, [term]);

  const classSubjects = useMemo(
    () => subjects.filter(s => String(s.class_id) === classId),
    [subjects, classId],
  );

  const toggleSubject = (id: string, checked: boolean) =>
    setSubjectIds(prev => (checked ? [...new Set([...prev, id])] : prev.filter(x => x !== id)));

  const selectedSubjects = useMemo(
    () => classSubjects.filter(s => subjectIds.includes(String(s.id))),
    [classSubjects, subjectIds],
  );
  const allSubjectsSelected = classSubjects.length > 0 && selectedSubjects.length === classSubjects.length;

  const selectedPackage = packages.find(p => String(p.id) === packageId) || null;
  const className = mode === "package"
    ? selectedPackage?.class_name || ""
    : classes.find(c => String(c.id) === classId)?.name || "";
  const subjectLabel = mode === "package"
    ? selectedPackage?.subject_name || ""
    : allSubjectsSelected
      ? ALL_SUBJECTS_LABEL
      : selectedSubjects.map(s => s.name).join(", ");
  const plan = className && subjectLabel ? `${className} - ${subjectLabel}` : "";

  // What the grant will unlock, so the admin can sanity-check before saving.
  const preview = useMemo(() => {
    if (!plan) return null;
    if (mode === "custom") {
      const cls = classes.find(c => String(c.id) === classId);
      return { classNames: cls ? [cls.name] : [], subjectCount: selectedSubjects.length };
    }
    const targets = resolvePlanClasses(className, classes);
    const wantsAll = subjectLabel.includes(ALL_SUBJECTS_LABEL);
    const subjectCount = targets
      .flatMap(c => subjects.filter(s => s.class_id === c.id))
      .filter(s => wantsAll || sameLabel(s.name, subjectLabel))
      .length;
    return { classNames: targets.map(c => c.name), subjectCount };
  }, [plan, mode, className, subjectLabel, classId, selectedSubjects, classes, subjects]);

  const totalDays = useMemo(() => {
    const start = new Date(`${startsAt}T00:00:00`).getTime();
    const end = new Date(`${endsAt}T23:59:59`).getTime();
    if (!startsAt || !endsAt || Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return Math.round((end - start) / 86400000);
  }, [startsAt, endsAt]);

  const handleGrant = async () => {
    if (!customer) { toast.error("ইমেইল দিয়ে গ্রাহক খুঁজে সিলেক্ট করুন"); return; }
    if (mode === "custom" && selectedSubjects.length === 0) { toast.error("অন্তত একটি বিষয় সিলেক্ট করুন"); return; }
    if (!plan) { toast.error("প্যাকেজ সিলেক্ট করুন"); return; }

    const startDate = new Date(`${startsAt}T00:00:00`);
    const endDate = new Date(`${endsAt}T23:59:59`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) { toast.error("তারিখ সঠিক নয়"); return; }
    if (endDate <= startDate) { toast.error("শেষের তারিখ শুরুর তারিখের পরে হতে হবে"); return; }

    const trimmedAmount = amount.trim();
    const amountValue = trimmedAmount === "" ? null : Number(trimmedAmount);
    if (amountValue !== null && (!Number.isFinite(amountValue) || amountValue < 0)) {
      toast.error("টাকার পরিমাণ সঠিক নয়"); return;
    }

    setSaving(true);
    try {
      const { error: subError } = await supabase.from("subscriptions").insert({
        teacher_id: customer.id,
        plan,
        status: "active",
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        source: "manual",
        amount: amountValue,
        note: note.trim() || null,
      });
      if (subError) {
        if (/does not exist|Could not find the/i.test(subError.message || "")) {
          throw new Error("ডেটাবেস আপডেট করা হয়নি — supabase/migrations/20260918020000_manual_subscription_payments.sql মাইগ্রেশনটি চালান");
        }
        throw subError;
      }

      // Mirror the bKash flow so subject level access opens for the same window.
      const wanted: { class_id: number; subject_id: number }[] = [];
      const seen = new Set<string>();
      const push = (subjectClassId: number, subjectIdNum: number) => {
        const key = `${subjectClassId}-${subjectIdNum}`;
        if (seen.has(key)) return;
        seen.add(key);
        wanted.push({ class_id: subjectClassId, subject_id: subjectIdNum });
      };

      if (mode === "custom") {
        const cls = classes.find(c => String(c.id) === classId);
        if (cls) selectedSubjects.forEach(s => push(cls.id, s.id));
      } else {
        const wantsAll = subjectLabel.includes(ALL_SUBJECTS_LABEL);
        resolvePlanClasses(className, classes).forEach(cls => {
          subjects
            .filter(s => s.class_id === cls.id)
            .filter(s => wantsAll || sameLabel(s.name, subjectLabel))
            .forEach(s => push(cls.id, s.id));
        });
      }

      let granted = 0;
      if (wanted.length > 0) {
        const { data: existing } = await supabase
          .from("user_permissions").select("class_id, subject_id").eq("user_id", customer.id);
        const have = new Set((existing || []).map(p => `${p.class_id}-${p.subject_id}`));
        const rows = wanted
          .filter(w => !have.has(`${w.class_id}-${w.subject_id}`))
          .map(w => ({ user_id: customer.id, class_id: w.class_id, subject_id: w.subject_id }));
        if (rows.length > 0) {
          const { error: permError } = await supabase.from("user_permissions").insert(rows);
          if (permError) throw permError;
          granted = rows.length;
        }
      }

      const who = customer.full_name || customer.email;
      const money = amountValue === null ? "" : ` · ৳${amountValue.toLocaleString("bn-BD")}`;
      if (wanted.length === 0) {
        toast.warning(`${who} কে "${plan}" দেওয়া হয়েছে${money}, তবে শ্রেণি মেলানো যায়নি — বিষয়ভিত্তিক অ্যাক্সেস দেওয়া হয়নি`);
      } else {
        toast.success(`${who} কে "${plan}" দেওয়া হয়েছে${money} (${granted}টি নতুন বিষয় অ্যাক্সেস)`);
      }
      onGranted?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "সেভ করা যায়নি"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-primary" /> ম্যানুয়াল প্যাকেজ অ্যাক্সেস
          </DialogTitle>
          <DialogDescription>
            WhatsApp বা অফলাইন পেমেন্টের পর গ্রাহকের ইমেইল দিয়ে তার অ্যাকাউন্টে নির্দিষ্ট মেয়াদের জন্য প্যাকেজ অ্যাক্সেস দিন।
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* গ্রাহক */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">১. গ্রাহক খুঁজুন</Label>
            {customer ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-primary shrink-0" /> {customer.full_name || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{customer.email}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setCustomer(null); setTerm(""); }} title="বদলান">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                  <Input
                    className="pl-10"
                    placeholder="ইমেইল বা নাম লিখুন..."
                    value={term}
                    onChange={e => setTerm(e.target.value)}
                  />
                  {searching && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                </div>
                {term.trim().length >= 3 && !searching && results.length === 0 && (
                  <p className="text-xs text-muted-foreground">এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।</p>
                )}
                {results.length > 0 && (
                  <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
                    {results.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setCustomer(t); setResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-accent/40 transition-colors"
                      >
                        <div className="text-sm font-medium">{t.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{t.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* প্যাকেজ */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">২. প্যাকেজ</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "package" ? "default" : "outline"}
                onClick={() => setMode("package")}
              >
                বিদ্যমান প্যাকেজ
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "custom" ? "default" : "outline"}
                onClick={() => setMode("custom")}
              >
                নিজে ঠিক করুন
              </Button>
            </div>

            {mode === "package" ? (
              <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger><SelectValue placeholder="প্যাকেজ সিলেক্ট করুন" /></SelectTrigger>
                <SelectContent>
                  {packages.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.class_name} — {p.subject_name} (৳{p.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-3">
                <Select value={classId} onValueChange={v => { setClassId(v); setSubjectIds([]); }}>
                  <SelectTrigger><SelectValue placeholder="শ্রেণি সিলেক্ট করুন" /></SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      বিষয় — একাধিক সিলেক্ট করা যাবে ({selectedSubjects.length}টি বাছাই করা হয়েছে)
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs"
                        disabled={classSubjects.length === 0}
                        onClick={() => setSubjectIds(classSubjects.map(s => String(s.id)))}
                      >
                        সব
                      </Button>
                      <Button
                        type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs"
                        disabled={subjectIds.length === 0}
                        onClick={() => setSubjectIds([])}
                      >
                        ক্লিয়ার
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border max-h-48 overflow-y-auto divide-y">
                    {classSubjects.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">প্রথমে শ্রেণি সিলেক্ট করুন</p>
                    ) : (
                      classSubjects.map(s => (
                        <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-accent/30">
                          <Checkbox
                            checked={subjectIds.includes(String(s.id))}
                            onCheckedChange={v => toggleSubject(String(s.id), v === true)}
                          />
                          <span>{s.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {allSubjectsSelected && (
                    <p className="text-xs text-emerald-700">
                      পুরো শ্রেণির সব বিষয় ({classSubjects.length}টি) — প্ল্যানে "{ALL_SUBJECTS_LABEL}" লেখা হবে
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* মেয়াদ */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">৩. মেয়াদ</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">শুরু</span>
                <Input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">শেষ</span>
                <Input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => (
                <Button
                  key={d.label}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEndsAt(toDateInput(addMonths(new Date(`${startsAt}T00:00:00`), d.months)))}
                >
                  {d.label}
                </Button>
              ))}
              {totalDays !== null && <Badge variant="outline" className="self-center">{totalDays} দিন</Badge>}
            </div>
          </div>

          {/* পেমেন্ট */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">৪. কত টাকা নেওয়া হয়েছে</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <Input
                  className="pl-10"
                  inputMode="numeric"
                  placeholder="যেমন: ৩০০০"
                  value={amount}
                  onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </div>
              <Input
                placeholder="নোট (বিকাশ, নগদ, হাতে হাতে...)"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              এখানে লেখা টাকার পরিমাণ ড্যাশবোর্ডে "ম্যানুয়াল আদায়" হিসেবে দেখা যাবে।
            </p>
          </div>

          {/* সারসংক্ষেপ */}
          {plan && (
            <div className="rounded-lg border bg-accent/30 p-3 space-y-1.5">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {plan}
              </div>
              {preview && (
                <div className="text-xs text-muted-foreground">
                  {preview.classNames.length > 0
                    ? `শ্রেণি: ${preview.classNames.join(", ")} · বিষয়ভিত্তিক অ্যাক্সেস: ${preview.subjectCount}টি`
                    : "সতর্কতা: এই শ্রেণির নাম ডেটাবেসে পাওয়া যায়নি, তাই শুধু সাবস্ক্রিপশন তৈরি হবে।"}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                মেয়াদ: {startsAt} থেকে {endsAt}
                {amount.trim() !== "" && !Number.isNaN(Number(amount)) ? ` · ৳${Number(amount).toLocaleString("bn-BD")}` : ""}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>বাতিল</Button>
          <Button className="gradient-green text-white border-0" onClick={handleGrant} disabled={saving || !customer || !plan}>
            {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> সেভ হচ্ছে...</> : "অ্যাক্সেস দিন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
