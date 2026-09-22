import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, ClipboardPaste, KeyRound, PlayCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import OmrEngineBanner from "@/components/omr/OmrEngineBanner";
import OmrSheetPaper from "@/components/omr/OmrSheetPaper";
import { useOmrEngine } from "@/hooks/useOmrEngine";
import { useElementWidth } from "@/hooks/useElementWidth";
import { A4_W_PX, OPTION_LETTERS, parseAnswerText, parseCode, toBn, validateScannableCode } from "@/lib/omrLayout";
import {
  createToken,
  deleteToken,
  listTokens,
  omrErrorMessage,
  saveAnswerScript,
  type OmrAnswerItem,
  type OmrToken,
} from "@/lib/omrEngine";

const NEGATIVE_CHOICES = [
  { value: 0, label: "নেই" },
  { value: 0.25, label: "০.২৫" },
  { value: 0.5, label: "০.৫০" },
];

export default function OmrTokens() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { status, loading, refresh, online } = useOmrEngine();

  const [tokens, setTokens] = useState<OmrToken[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(searchParams.get("token") || "");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [dirty, setDirty] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    title: "",
    code: searchParams.get("code") || "",
    negative: 0,
  });

  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewWidth = useElementWidth(previewRef);

  const selected = useMemo(
    () => tokens.find((token) => token.id === selectedId) || null,
    [tokens, selectedId],
  );

  const scale = previewWidth ? Math.min(1, previewWidth / A4_W_PX) : 0.5;
  const totalQuestions = selected?.number_of_question || 0;
  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value >= 0).length,
    [answers],
  );

  const loadTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const rows = await listTokens();
      setTokens(rows);
      return rows;
    } catch (error) {
      toast.error(omrErrorMessage(error));
      return [];
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    if (!online) return;
    void loadTokens();
  }, [online, loadTokens]);

  useEffect(() => {
    if (!selected) {
      setAnswers({});
      return;
    }
    const next: Record<number, number> = {};
    (selected.answer_script || []).forEach((item) => {
      if (Number(item.answerIndex) >= 0) next[Number(item.questionIndex) + 1] = Number(item.answerIndex);
    });
    setAnswers(next);
    setDirty(false);
  }, [selected]);

  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) setForm((prev) => ({ ...prev, code: codeFromUrl }));
  }, [searchParams]);

  const applyTokenSelection = (tokenId: string) => {
    setSelectedId(tokenId);
    const next = new URLSearchParams(searchParams);
    if (tokenId) next.set("token", tokenId);
    else next.delete("token");
    next.delete("code");
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error("পরীক্ষার টাইটেল দিন");
      return;
    }
    const codeError = validateScannableCode(form.code);
    if (codeError) {
      toast.error(codeError);
      return;
    }
    const info = parseCode(form.code)!;
    setBusy(true);
    try {
      const token = await createToken({
        title,
        omr_code: info.code,
        columns: info.columns,
        number_of_question: info.questions,
        negative_marking: form.negative,
      });
      toast.success("টোকেন তৈরি হয়েছে - এখন উত্তরপত্র (চাবি) বসান");
      setForm({ title: "", code: "", negative: form.negative });
      const rows = await loadTokens();
      const fresh = rows.find((row) => row.id === token.id) || token;
      applyTokenSelection(fresh.id);
    } catch (error) {
      toast.error(omrErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handlePick = (question: number, option: number) => {
    setAnswers((prev) => {
      if (prev[question] === option) {
        const copy = { ...prev };
        delete copy[question];
        return copy;
      }
      return { ...prev, [question]: option };
    });
    setDirty(true);
  };

  const handlePaste = () => {
    if (!selected) return;
    const parsed = parseAnswerText(pasteText);
    if (!parsed.length) {
      toast.error("কোনো উত্তর পাওয়া যায়নি");
      return;
    }
    const next: Record<number, number> = {};
    parsed.slice(0, selected.number_of_question).forEach((value, index) => {
      if (value >= 0) next[index + 1] = value;
    });
    setAnswers(next);
    setDirty(true);
    setPasteText("");
    toast.success(`${toBn(Object.keys(next).length)}টি উত্তর বসানো হয়েছে`);
  };

  const handleClear = () => {
    setAnswers({});
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const script: OmrAnswerItem[] = Array.from({ length: selected.number_of_question }, (_, index) => ({
        questionIndex: index,
        answerIndex: answers[index + 1] ?? -1,
      }));
      await saveAnswerScript(selected.id, script);
      toast.success("উত্তরপত্র সেভ হয়েছে");
      setDirty(false);
      await loadTokens();
      await refresh();
    } catch (error) {
      toast.error(omrErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteToken(selected.id);
      toast.success("টোকেন মুছে ফেলা হয়েছে");
      applyTokenSelection("");
      await loadTokens();
      await refresh();
    } catch (error) {
      toast.error(omrErrorMessage(error));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-primary" /> OMR টোকেন
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          একটি পরীক্ষার জন্য একটি টোকেন বানান, শীটের OMR কোড দিন এবং প্রশ্নের সঠিক উত্তর (চাবি) বাবলে ক্লিক করে সেভ করুন।
        </p>
      </div>

      <OmrEngineBanner status={status} loading={loading} onRetry={refresh} />

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">নতুন টোকেন</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="token-title">পরীক্ষার টাইটেল</Label>
                <Input
                  id="token-title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="যেমন: বাংলা ১ম পত্র - অর্ধবার্ষিক"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="token-code">OMR CODE</Label>
                <Input
                  id="token-code"
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="যেমন: 12110"
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">শীটের উপরে লেখা কোডটি হুবহু দিন।</p>
              </div>

              <div className="space-y-1.5">
                <Label>নেগেটিভ মার্কিং</Label>
                <div className="flex gap-2">
                  {NEGATIVE_CHOICES.map((choice) => (
                    <Button
                      key={choice.value}
                      type="button"
                      size="sm"
                      variant={form.negative === choice.value ? "default" : "outline"}
                      onClick={() => setForm((prev) => ({ ...prev, negative: choice.value }))}
                    >
                      {choice.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">ভুল উত্তর প্রতি ভুলের জন্য নম্বর কাটা যাবে।</p>
              </div>

              <Button className="w-full" onClick={handleCreate} disabled={busy || !online}>
                টোকেন তৈরি করুন
              </Button>
              {!online && (
                <p className="text-xs text-amber-700">টোকেন সেভ করতে ইন্টারনেট সংযোগ দরকার।</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">টোকেন লিস্ট</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => void loadTokens()} disabled={!online || loadingTokens}>
                রিফ্রেশ
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {!online && <p className="text-sm text-muted-foreground">সংযোগ ফিরলে টোকেন দেখা যাবে।</p>}
              {online && !tokens.length && !loadingTokens && (
                <p className="text-sm text-muted-foreground">এখনো কোনো টোকেন নেই।</p>
              )}
              {tokens.map((token) => {
                const answered = (token.answer_script || []).filter((item) => Number(item.answerIndex) >= 0).length;
                const active = token.id === selectedId;
                return (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => applyTokenSelection(token.id)}
                    className={
                      "w-full text-left rounded-lg border p-3 transition-colors " +
                      (active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{token.title}</span>
                      {answered >= token.number_of_question ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-normal">
                        কোড {token.omr_code || "-"}
                      </Badge>
                      <span>
                        উত্তর {toBn(answered)}/{toBn(token.number_of_question)}
                      </span>
                      {token.negative_marking ? <span>নেগেটিভ {toBn(token.negative_marking)}</span> : null}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              উত্তরপত্র (চাবি)
              {selected ? (
                <>
                  <Badge variant="secondary">{toBn(selected.column)} কলাম</Badge>
                  <Badge variant="secondary">{toBn(selected.number_of_question)} প্রশ্ন</Badge>
                  {dirty ? <Badge variant="destructive">সেভ হয়নি</Badge> : null}
                </>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 min-w-0">
            {!selected && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                বাঁ দিক থেকে একটি টোকেন বাছুন, অথবা নতুন টোকেন তৈরি করুন।
              </div>
            )}

            {selected && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <Label htmlFor="paste-answers" className="flex items-center gap-1.5">
                      <ClipboardPaste className="w-3.5 h-3.5" /> উত্তর পেস্ট
                    </Label>
                    <Textarea
                      id="paste-answers"
                      value={pasteText}
                      onChange={(event) => setPasteText(event.target.value)}
                      placeholder="ক খ গ ঘ ক খ ... অথবা 1 2 3 4 1 2 ..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handlePaste} disabled={!pasteText.trim()}>
                      বসান
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleClear}>
                      সব মুছুন
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      পূরণ হয়েছে {toBn(answeredCount)} / {toBn(totalQuestions)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      নিচের শীটে বাবলে ক্লিক করে সঠিক উত্তর সেট করুন
                    </span>
                  </div>
                  <Progress value={totalQuestions ? (answeredCount / totalQuestions) * 100 : 0} />
                </div>

                <div ref={previewRef} className="w-full overflow-hidden flex justify-center bg-muted/30 rounded-lg p-2">
                  <div style={{ width: A4_W_PX * scale, height: 1123 * scale }}>
                    <OmrSheetPaper
                      columns={selected.column}
                      questions={selected.number_of_question}
                      code={selected.omr_code || ""}
                      instituteName={selected.title}
                      showFields={false}
                      answers={answers}
                      onPick={handlePick}
                      scale={scale}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleSave} disabled={busy}>
                    <Save className="w-4 h-4 mr-1.5" /> সেভ করুন
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/dashboard/omr-evaluation?token=${selected.id}`}>
                      <PlayCircle className="w-4 h-4 mr-1.5" /> মূল্যায়নে যান
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="ml-auto text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> টোকেন মুছুন
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  পেস্ট করার সময় বাংলা {"ক খ গ ঘ"} ছাড়াও {"1 2 3 4"} বা {"A B C D"} ব্যবহার করা যায়। সব প্রশ্ন পূরণ
                  না হলে মূল্যায়নের সময় সেই প্রশ্নগুলো ভুল হিসেবে ধরা হবে।
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>টোকেনটি মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              "{selected?.title}" টোকেন এবং এর সাথে জমা হওয়া ফলাফলও মুছে যাবে। এটি ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>মুছে ফেলুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
