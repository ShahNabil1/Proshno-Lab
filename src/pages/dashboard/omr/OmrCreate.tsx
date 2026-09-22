import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Grid, Info, KeyRound, Printer } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import OmrSheetPaper, { OmrPrintPaper } from "@/components/omr/OmrSheetPaper";
import {
  A4_W_PX,
  COLUMNS_CHOICES,
  makeCode,
  maxQuestionsForColumns,
  questionsThatFit,
  toBn,
  type ColumnCount,
} from "@/lib/omrLayout";

const COLUMN_HINTS: Record<number, string> = {
  2: "২ কলাম - প্রশ্নপ্রতি বেশি জায়গা",
  3: "৩ কলাম - মাঝারি পরীক্ষার জন্য",
  4: "৪ কলাম - বড় পরীক্ষার জন্য",
};

const columnHint = (columns: number): string =>
  `${COLUMN_HINTS[columns]} · এক A4 পাতায় সর্বোচ্চ ${toBn(maxQuestionsForColumns(columns))} প্রশ্ন`;

export default function OmrCreate() {
  const { user } = useAuth();
  const [instituteName, setInstituteName] = useState("প্রতিষ্ঠানের নাম");
  const [instituteAddress, setInstituteAddress] = useState("ঠিকানা এখানে লিখুন");
  const [logoText, setLogoText] = useState("অ");
  const [examTitle, setExamTitle] = useState("");
  const [columns, setColumns] = useState<ColumnCount>(2);
  const [questions, setQuestions] = useState(20);
  const [previewWidth, setPreviewWidth] = useState(0);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const code = useMemo(() => makeCode(columns, questions), [columns, questions]);
  // a sheet taller than A4 prints on two pages and can never be scanned
  const questionChoices = useMemo(() => questionsThatFit(columns), [columns]);
  const maxQuestions = useMemo(() => maxQuestionsForColumns(columns), [columns]);

  useEffect(() => {
    if (questions <= maxQuestions) return;
    setQuestions(questionChoices[questionChoices.length - 1]);
  }, [maxQuestions, questionChoices, questions]);
  const scale = previewWidth ? Math.min(1, previewWidth / A4_W_PX) : 0.45;

  useEffect(() => {
    document.documentElement.dataset.printSize = "210mm 297mm";
    return () => {
      delete document.documentElement.dataset.printSize;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("institutes")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const name = (data.name as string) || "";
        const address = [(data as any).specific_address, (data as any).upazila, (data as any).district]
          .filter(Boolean)
          .join(", ");
        if (name) {
          setInstituteName(name);
          setLogoText(name.trim().charAt(0) || "অ");
        }
        if (address) setInstituteAddress(address);
      });
  }, [user]);

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    const measure = () => setPreviewWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`OMR কোড ${code} কপি হয়েছে`);
    } catch {
      toast.error("কপি করা যায়নি, কোডটি হাতে লিখে নিন: " + code);
    }
  };

  const sheetProps = {
    columns,
    questions,
    code,
    instituteName,
    instituteAddress,
    logoText,
    examTitle: examTitle.trim() || undefined,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <Grid className="w-6 h-6 text-primary" /> OMR শীট তৈরি
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          প্রতিষ্ঠানের তথ্য দিয়ে A4 OMR শীট বানান, প্রিন্ট করুন এবং শীটে ওঠা OMR কোডটি টোকেন তৈরির সময় ব্যবহার করুন।
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">শীটের সেটিংস</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="omr-institute">প্রতিষ্ঠানের নাম</Label>
                <Input
                  id="omr-institute"
                  value={instituteName}
                  onChange={(event) => setInstituteName(event.target.value)}
                  placeholder="যেমন: শহীদ স্মৃতি উচ্চ বিদ্যালয়"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="omr-address">ঠিকানা</Label>
                <Input
                  id="omr-address"
                  value={instituteAddress}
                  onChange={(event) => setInstituteAddress(event.target.value)}
                  placeholder="যেমন: সদর, কুমিল্লা"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="omr-logo">লোগো অক্ষর</Label>
                  <Input
                    id="omr-logo"
                    value={logoText}
                    maxLength={2}
                    onChange={(event) => setLogoText(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="omr-title">পরীক্ষার নাম (ঐচ্ছিক)</Label>
                  <Input
                    id="omr-title"
                    value={examTitle}
                    onChange={(event) => setExamTitle(event.target.value)}
                    placeholder="যেমন: বার্ষিক পরীক্ষা ২০২৬"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>কলাম সংখ্যা</Label>
                <div className="flex gap-2">
                  {COLUMNS_CHOICES.map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={columns === value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setColumns(value)}
                    >
                      {toBn(value)} কলাম
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{columnHint(columns)}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="omr-questions">প্রশ্ন সংখ্যা</Label>
                <select
                  id="omr-questions"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={questions}
                  onChange={(event) => setQuestions(Number(event.target.value))}
                >
                  {questionChoices.map((value) => (
                    <option key={value} value={value}>
                      {toBn(value)} প্রশ্ন
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {toBn(columns)} কলামে সর্বোচ্চ {toBn(maxQuestions)} প্রশ্ন পর্যন্ত - এর বেশি হলে প্রিন্ট দুই পাতায় ভাগ হয়ে যায়।
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">OMR কোড</p>
                    <p className="font-heading text-xl font-bold tracking-wide">{code}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={copyCode}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> কপি
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  এই কোডটি শীটেই লেখা থাকবে। মূল্যায়নের আগে টোকেন পাতায় ঠিক এই কোডটি দিতে হবে, নইলে ইঞ্জিন শীটটি চিনবে না।
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1.5" /> প্রিন্ট / PDF
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/dashboard/omr-tokens?code=${code}`}>
                    <KeyRound className="w-4 h-4 mr-1.5" /> এই কোড দিয়ে টোকেন তৈরি করুন
                  </Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                প্রিন্ট ডায়ালগে Paper = A4, Margins = None, Scale = Default রাখুন। প্রিন্টের আগে একটি কপি
                দেখে নিন যেন চার দিকের কালো বর্ডার পুরোটা কাগজে থাকে।
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">OMR কোডের অর্থ</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p className="font-heading text-lg text-foreground tracking-[0.3em]">১ ৪ ১ ০০</p>
              <p>১ - টেমপ্লেট (১ = স্ক্যানযোগ্য)</p>
              <p>৪ - কলাম সংখ্যা (২, ৩ বা ৪)</p>
              <p>১ - মার্কার (সবসময় ১)</p>
              <p>০০ - প্রশ্ন সংখ্যা (১০ থেকে ১০০)</p>
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">প্রিভিউ</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{toBn(columns)} কলাম</Badge>
              <Badge variant="secondary">{toBn(questions)} প্রশ্ন</Badge>
              <Badge variant="outline">A4</Badge>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <div ref={previewRef} className="w-full overflow-hidden flex justify-center bg-muted/30 rounded-lg p-2">
              <div
                style={{
                  width: A4_W_PX * scale,
                  height: 1123 * scale,
                }}
              >
                <OmrSheetPaper {...sheetProps} scale={scale} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* print only copy - hidden on screen by .omr-print-root */}
      <OmrPrintPaper {...sheetProps} />
    </div>
  );
}
