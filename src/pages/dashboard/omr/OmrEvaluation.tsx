import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Camera, CheckCircle2, Download, FileImage, FlaskConical, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import OmrEngineBanner from "@/components/omr/OmrEngineBanner";
import { useOmrEngine } from "@/hooks/useOmrEngine";
import { OPTION_LETTERS, toBn } from "@/lib/omrLayout";
import { renderSampleSheet } from "@/lib/omrSheetCanvas";
import {
  downloadEvaluationsCsv,
  evaluateImages,
  fileToBase64,
  listEvaluations,
  listTokens,
  omrErrorMessage,
  type OmrEvaluationEntry,
  type OmrEvaluationRow,
  type OmrToken,
  type UploadImage,
} from "@/lib/omrEngine";

const MAX_DIM = 1920;

interface PickedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
}

const prepareImage = async (file: File): Promise<UploadImage> => {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_DIM) {
    bitmap.close?.();
    return { name: file.name, data: await fileToBase64(file) };
  }
  const ratio = MAX_DIM / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close?.();
    return { name: file.name, data: await fileToBase64(file) };
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((result) => resolve(result || file), "image/jpeg", 0.92),
  );
  return { name: file.name.replace(/\.[^.]+$/, "") + ".jpg", data: await fileToBase64(blob) };
};

const statusLabel: Record<string, string> = {
  correct: "সঠিক",
  incorrect: "ভুল",
  multiple: "একাধিক দাগ",
  unanswered: "উত্তর দেয়নি",
};

const statusClass: Record<string, string> = {
  correct: "text-emerald-700 bg-emerald-50 border-emerald-200",
  incorrect: "text-red-700 bg-red-50 border-red-200",
  multiple: "text-amber-700 bg-amber-50 border-amber-200",
  unanswered: "text-slate-600 bg-slate-50 border-slate-200",
};

export default function OmrEvaluation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { status, loading, refresh, online } = useOmrEngine({ warmVision: true });

  const [tokens, setTokens] = useState<OmrToken[]>([]);
  const [tokenId, setTokenId] = useState(searchParams.get("token") || "");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [results, setResults] = useState<OmrEvaluationEntry[]>([]);
  const [history, setHistory] = useState<OmrEvaluationRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const token = useMemo(() => tokens.find((item) => item.id === tokenId) || null, [tokens, tokenId]);

  const loadTokens = useCallback(async () => {
    try {
      const rows = await listTokens();
      setTokens(rows);
      if (!tokenId && rows.length) {
        setTokenId(rows[0].id);
        const next = new URLSearchParams(searchParams);
        next.set("token", rows[0].id);
        setSearchParams(next, { replace: true });
      }
    } catch (error) {
      toast.error(omrErrorMessage(error));
    }
  }, [searchParams, setSearchParams, tokenId]);

  const loadHistory = useCallback(async (id: string) => {
    if (!id) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await listEvaluations(id));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (!online) return;
    void loadTokens();
  }, [online, loadTokens]);

  useEffect(() => {
    if (!online) return;
    void loadHistory(tokenId);
  }, [tokenId, online, loadHistory]);

  useEffect(() => {
    const fromUrl = searchParams.get("token");
    if (fromUrl && fromUrl !== tokenId) setTokenId(fromUrl);
  }, [searchParams, tokenId]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length) return;
    setImages((prev) => [
      ...prev,
      ...list.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
      })),
    ]);
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearImages = () => {
    images.forEach((item) => URL.revokeObjectURL(item.preview));
    setImages([]);
  };

  const runEvaluation = async (overrideImages?: UploadImage[], batchId?: string) => {
    if (!tokenId) {
      toast.error("আগে একটি টোকেন বাছুন");
      return;
    }
    setBusy(true);
    try {
      let payload: UploadImage[];
      if (overrideImages) {
        payload = overrideImages;
      } else {
        payload = [];
        for (const item of images) {
          payload.push(await prepareImage(item.file));
        }
      }
      if (!payload.length) {
        toast.error("কোনো ছবি দেওয়া হয়নি");
        return;
      }
      const response = await evaluateImages(
        tokenId,
        batchId || `PL-${Date.now().toString(36).toUpperCase()}`,
        payload,
      );
      setResults(response.results);
      const failed = response.results.filter((entry) => !entry.ok).length;
      if (failed) toast.error(`${toBn(failed)}টি ছবি মূল্যায়ন করা যায়নি`);
      else toast.success("মূল্যায়ন সম্পন্ন হয়েছে");
      await loadHistory(tokenId);
      await refresh();
    } catch (error) {
      toast.error(omrErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const runSelfTest = async () => {
    if (!token) {
      toast.error("আগে একটি টোকেন বাছুন");
      return;
    }
    const answered = (token.answer_script || []).filter((item) => Number(item.answerIndex) >= 0).length;
    if (!answered) {
      toast.error("টোকেনের উত্তরপত্র আগে সেভ করুন");
      return;
    }
    setBusy(true);
    try {
      const filled: Record<number, number> = {};
      (token.answer_script || []).forEach((item) => {
        const option = Number(item.answerIndex);
        if (option >= 0) filled[Number(item.questionIndex) + 1] = option;
      });
      const { canvas } = renderSampleSheet(token.column, token.number_of_question, filled);
      const dataUrl = canvas.toDataURL("image/png");
      const expected = answered;
      const payload = { name: "sample-sheet.png", data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
      await runEvaluation([payload], "SELFTEST");
      const latest = await listEvaluations(token.id);
      const row = latest.find((item) => item.batch_id === "SELFTEST") || latest[0];
      if (row) {
        const marks = Number(row.result?.result ?? 0);
        if (Math.abs(marks - expected) < 1e-6) toast.success(`সিস্টেম ঠিক আছে ✓ নমুনা শীটে ${toBn(marks)} নম্বর এসেছে`);
        else toast.warning(`নমুনা শীটে ${toBn(marks)} নম্বর এসেছে, ${toBn(expected)} আশা করা ছিল`);
      }
    } catch (error) {
      toast.error(omrErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    if (!tokenId) return;
    setBusy(true);
    try {
      const rows = await downloadEvaluationsCsv(tokenId);
      if (!rows) toast.error("এই টোকেনে এখনো কোনো ফলাফল নেই");
      else toast.success(`${toBn(rows)}টি ফলাফলের CSV ডাউনলোড হয়েছে`);
    } catch (error) {
      toast.error(omrErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-primary" /> OMR মূল্যায়ন
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            শিক্ষার্থীর পূরণ করা শীটের ছবি দিন - দাগ পড়া, নম্বর হিসাব, ভুলের তালিকা ও দাগানো কপি একসাথে পাবেন।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runSelfTest} disabled={busy || !token}>
            <FlaskConical className="w-4 h-4 mr-1.5" /> সিস্টেম পরীক্ষা (নমুনা শীট)
          </Button>
          {tokenId ? (
            <Button variant="outline" onClick={exportCsv} disabled={busy}>
              <Download className="w-4 h-4 mr-1.5" /> এই টোকেনের CSV
            </Button>
          ) : null}
        </div>
      </div>

      <OmrEngineBanner status={status} loading={loading} onRetry={refresh} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">টোকেন ও ছবি</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="eval-token">টোকেন</Label>
              <select
                id="eval-token"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={tokenId}
                onChange={(event) => {
                  const value = event.target.value;
                  setTokenId(value);
                  setResults([]);
                  const next = new URLSearchParams(searchParams);
                  if (value) next.set("token", value);
                  else next.delete("token");
                  setSearchParams(next, { replace: true });
                }}
                disabled={!online}
              >
                <option value="">টোকেন বাছুন</option>
                {tokens.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.omr_code || "-"})
                  </option>
                ))}
              </select>
              {token ? (
                <p className="text-xs text-muted-foreground">
                  কোড {token.omr_code} · {toBn(token.column)} কলাম · {toBn(token.number_of_question)} প্রশ্ন · উত্তরপত্র{" "}
                  {toBn((token.answer_script || []).filter((item) => Number(item.answerIndex) >= 0).length)}/
                  {toBn(token.number_of_question)} · নেগেটিভ {toBn(token.negative_marking)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => cameraInputRef.current?.click()} disabled={!online}>
                <Camera className="w-4 h-4 mr-1.5" /> ক্যামেরা দিয়ে তুলুন
              </Button>
              <Button variant="outline" onClick={clearImages} disabled={!images.length}>
                <Trash2 className="w-4 h-4 mr-1.5" /> ছবি মুছুন
              </Button>
            </div>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              addFiles(event.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={
              "rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors " +
              (dragActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")
            }
          >
            <Upload className="w-7 h-7 mx-auto text-muted-foreground" />
            <p className="mt-2 font-semibold">ছবি এখানে ড্র্যাগ করুন অথবা ক্লিক করে ফাইল বেছে নিন</p>
            <p className="text-xs text-muted-foreground mt-1">
              একসাথে অনেক ছবি দেওয়া যায় (JPG / PNG)। ১৯২০ পিক্সেলের বড় ছবি নিজে থেকেই ছোট হয়ে যাবে।
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {images.map((item) => (
                <div key={item.id} className="relative w-24">
                  <img src={item.preview} alt={item.name} className="w-24 h-32 object-cover rounded-md border" />
                  <button
                    type="button"
                    onClick={() => removeImage(item.id)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    aria-label="ছবি সরান"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={() => void runEvaluation()} disabled={busy || !online || !images.length}>
            <FileImage className="w-4 h-4 mr-1.5" />
            {busy ? "মূল্যায়ন চলছে..." : `মূল্যায়ন করুন (${toBn(images.length)}টি ছবি)`}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-bold">ফলাফল</h2>
          {results.map((entry, index) => (
            <Card key={`${entry.name}-${index}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-2">
                  <span className="truncate">{entry.name}</span>
                  {entry.ok && entry.result ? (
                    <Badge variant="secondary">প্রাপ্ত নম্বর {toBn(entry.result.result)}</Badge>
                  ) : (
                    <Badge variant="destructive">মূল্যায়ন হয়নি</Badge>
                  )}
                  {entry.processing_time ? (
                    <span className="text-xs text-muted-foreground">{toBn(entry.processing_time)} ms</span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!entry.ok && (
                  <p className="text-sm text-destructive">
                    {entry.error?.message || "ছবিটি মূল্যায়ন করা যায়নি"}
                  </p>
                )}

                {entry.ok && entry.result && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {[
                        { label: "সঠিক", value: entry.result.correct, tone: "text-emerald-700" },
                        { label: "ভুল", value: entry.result.incorrect, tone: "text-red-700" },
                        { label: "একাধিক দাগ", value: entry.result.multiple_touched, tone: "text-amber-700" },
                        { label: "উত্তর দেয়নি", value: entry.result.unanswered, tone: "text-slate-600" },
                        { label: "নেগেটিভ", value: entry.result.total_negative, tone: "text-red-700" },
                        { label: "মোট প্রশ্ন", value: entry.result.total_questions, tone: "text-slate-700" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-border p-2">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className={`text-lg font-bold ${item.tone}`}>{toBn(item.value)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">দাগানো কপি</p>
                        {entry.answer_script_url ? (
                          <a href={entry.answer_script_url} target="_blank" rel="noreferrer">
                            <img
                              src={entry.answer_script_url}
                              alt="দাগানো কপি"
                              className="w-full rounded-lg border bg-white"
                            />
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground">দাগানো কপি পাওয়া যায়নি।</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          সবুজ = সঠিক, লাল = ভুল, কমলা = একাধিক দাগ। ছবিতে ক্লিক করে বড় করে দেখুন।
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold mb-2">প্রশ্নভিত্তিক ফলাফল</p>
                        <div className="max-h-[420px] overflow-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16">প্রশ্ন</TableHead>
                                <TableHead>দাগানো</TableHead>
                                <TableHead>সঠিক উত্তর</TableHead>
                                <TableHead className="w-28">ফলাফল</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(entry.per_question || []).map((question) => (
                                <TableRow key={question.number}>
                                  <TableCell>{toBn(question.number)}</TableCell>
                                  <TableCell>
                                    {question.marked === null || question.marked === undefined
                                      ? "-"
                                      : OPTION_LETTERS[question.marked]}
                                  </TableCell>
                                  <TableCell>
                                    {question.correct >= 0 ? OPTION_LETTERS[question.correct] : "-"}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={`inline-block rounded border px-1.5 py-0.5 text-xs ${statusClass[question.status]}`}
                                    >
                                      {statusLabel[question.status]}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">এই টোকেনের পুরনো ফলাফল</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>সময়</TableHead>
                    <TableHead>ছবি</TableHead>
                    <TableHead>নম্বর</TableHead>
                    <TableHead>সঠিক</TableHead>
                    <TableHead>ভুল</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {row.created_at}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.image_name}</TableCell>
                      <TableCell className="font-semibold">{toBn(row.result?.result ?? 0)}</TableCell>
                      <TableCell>{toBn(row.result?.correct ?? 0)}</TableCell>
                      <TableCell>{toBn(row.result?.incorrect ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              শিক্ষার্থীর ছবি কোথাও জমা রাখা হয় না - আপনার ব্রাউজারে পড়া হয়, শুধু নম্বর ও ফলাফল সংরক্ষিত থাকে।
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
