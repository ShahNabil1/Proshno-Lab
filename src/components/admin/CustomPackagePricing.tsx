import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { builderAdminClient, defaultPricing, type BuilderConfig, type SubjectPricing } from "@/lib/customPackages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { getClassLevelKey, isEnglishVersionClass } from "@/lib/subjectVersion";

type AcademicClass = { id: number; name: string };
type Package = { id: number; class_name: string; subject_name: string; price: number; subject_ids: number[] | null; is_active: boolean };
type Subject = { id: number; name: string; class_id: number };
const initial: BuilderConfig = { class_id: 0, version: "bangla", class_level: "6", all_package_id: 0, ...defaultPricing("6"), groups: [], is_active: false, sort_order: 0 };
const selectStyle = "w-full min-h-11 rounded-md border bg-background px-3 text-sm";
const sameClass = (packageName: string, className: string) => getClassLevelKey(packageName) === getClassLevelKey(className) && isEnglishVersionClass(packageName) === isEnglishVersionClass(className);

export default function CustomPackagePricing() {
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [configs, setConfigs] = useState<BuilderConfig[]>([]);
  const [subjectSettings, setSubjectSettings] = useState<SubjectPricing[]>([]);
  const [form, setForm] = useState(initial);
  const [caps, setCaps] = useState(JSON.stringify(initial.caps, null, 2));
  const [groups, setGroups] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("classes").select("id,name").order("id"),
      supabase.from("subjects").select("id,name,class_id").order("id"),
      supabase.from("pricing_packages").select("id,class_name,subject_name,price,subject_ids,is_active"),
      builderAdminClient.from("custom_package_pricing").select("*"),
      builderAdminClient.from("custom_package_subjects").select("*"),
    ]).then(([c, s, p, cp, sp]) => {
      setClasses(c.data || []); setSubjects(s.data || []); setPackages(p.data || []);
      if (c.error || s.error || p.error || cp.error || sp.error) { setLoadError(true); toast.error("Could not load custom pricing. Check database setup and admin access."); return; }
      setConfigs(cp.data || []); setSubjectSettings(sp.data || []); setReady(true);
    }).catch(() => setLoadError(true));
  }, []);

  function chooseClass(id: number) {
    const config = configs.find(c => c.class_id === id);
    const name = classes.find(c => c.id === id)?.name || "";
    const level = getClassLevelKey(name);
    const next: BuilderConfig = config || { ...initial, class_id: id, class_level: level, ...defaultPricing(level), version: isEnglishVersionClass(name) ? "english" : "bangla", all_package_id: packages.find(p => sameClass(p.class_name,name) && p.subject_name === "সকল বিষয়" && p.subject_ids === null)?.id || 0 };
    setForm(next); setCaps(JSON.stringify(next.caps, null, 2)); setGroups(next.groups.join(", "));
  }
  async function save() {
    setBusy(true);
    try {
      const parsed: unknown = JSON.parse(caps);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Caps must be a JSON object");
      const tiers = parsed as Record<string, number>;
      if (Object.entries(tiers).some(([k,v]) => !/^\d+$/.test(k) || Number(k) < 2 || !Number.isFinite(v) || v <= 0)) throw new Error("Use positive prices and subject counts of 2 or more");
      if (!form.class_id || !form.all_package_id) throw new Error("Choose a class and its All Subjects package");
      const groupList = [...new Set(groups.split(",").map(g => g.trim()).filter(Boolean))];
      const invalid = subjects.filter(s => s.class_id === form.class_id).some(s => subjectSettings.find(p => p.subject_id === s.id)?.groups.some(g => !groupList.includes(g)));
      if (invalid) throw new Error("Remove obsolete subject group assignments before changing class groups");
      const next = { ...form, caps: tiers, groups: groupList };
      const { error } = await builderAdminClient.from("custom_package_pricing").upsert(next);
      if (error) throw error;
      setConfigs(prev => [...prev.filter(c => c.class_id !== next.class_id), next]); setForm(next);
      toast.success("Custom pricing saved. Existing purchases are unchanged.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save pricing"); } finally { setBusy(false); }
  }
  async function saveSubject(subject: Subject, update: Partial<SubjectPricing>) {
    const old = subjectSettings.find(s => s.subject_id === subject.id);
    const next = { subject_id: subject.id, individual_price: old?.individual_price ?? null, is_special: old?.is_special ?? false, groups: old?.groups || [], is_active: old?.is_active ?? true, sort_order: old?.sort_order ?? 0, ...update };
    const { error } = await builderAdminClient.from("custom_package_subjects").upsert(next);
    if (error) { toast.error(error.message); return; }
    setSubjectSettings(prev => [...prev.filter(s => s.subject_id !== subject.id), next]);
    toast.success("Subject pricing saved");
  }

  return <Card><CardContent className="p-5 space-y-5">
    <div><h2 className="text-xl font-heading font-bold">Custom Package Pricing</h2><p className="mt-1 text-sm text-muted-foreground">Configure each version and class independently. Prices affect future purchases. Select special subjects and group memberships using the actual subject IDs below.</p></div>
    {!ready && <p role={loadError ? "alert" : "status"} className="text-sm text-muted-foreground">{loadError ? "Could not load custom pricing. Check database setup and admin access." : "Loading custom pricing…"}</p>}
    <label className="block space-y-1 text-sm">Class<select className={selectStyle} value={form.class_id || ""} onChange={e => chooseClass(Number(e.target.value))}><option value="">Choose class</option>{classes.filter(c => ["6","7","8","9-10","11-12"].includes(getClassLevelKey(c.name))).map(c => <option key={c.id} value={c.id}>{c.name} (ID {c.id})</option>)}</select></label>
    {form.class_id > 0 && <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm">Version<select className={selectStyle} value={form.version} onChange={e => setForm({ ...form, version: e.target.value as BuilderConfig["version"] })}><option value="bangla">Bangla Version</option><option value="english">English Version</option></select></label>
        <label className="space-y-1 text-sm">Class level<select className={selectStyle} value={form.class_level} onChange={e => { const level=e.target.value; setForm({ ...form, class_level: level, ...defaultPricing(level) }); setCaps(JSON.stringify(defaultPricing(level).caps,null,2)); }}>{["6","7","8","9-10","11-12"].map(l => <option key={l}>{l}</option>)}</select></label>
        <label className="space-y-1 text-sm">All Subjects package<select className={selectStyle} value={form.all_package_id || ""} onChange={e => setForm({ ...form, all_package_id: Number(e.target.value) })}><option value="">Choose package</option>{packages.filter(p => sameClass(p.class_name, classes.find(c => c.id === form.class_id)?.name || "") && p.subject_name === "সকল বিষয়" && p.subject_ids === null).map(p => <option key={p.id} value={p.id}>#{p.id} — ৳{p.price}{!p.is_active && " (inactive)"}</option>)}</select></label>
        <label className="space-y-1 text-sm">Normal annual price<Input type="number" min="0.01" step="0.01" value={form.normal_price} onChange={e => setForm({ ...form, normal_price: Number(e.target.value) })} /></label>
        <label className="space-y-1 text-sm">Special annual price<Input type="number" min="0.01" step="0.01" value={form.special_price} onChange={e => setForm({ ...form, special_price: Number(e.target.value) })} /></label>
        <label className="space-y-1 text-sm">Display order<Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} /></label>
      </div>
      <label className="block space-y-1 text-sm">Groups (comma separated; leave empty for classes 6–8)<Input value={groups} onChange={e => setGroups(e.target.value)} placeholder="Science, Business Studies, Humanities, Common Subjects" /></label>
      <label className="block space-y-1 text-sm">Subject-count caps (JSON)<textarea className="w-full min-h-32 rounded-md border bg-background p-3 font-mono text-sm" value={caps} onChange={e => setCaps(e.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />Enable builder for this class after checking subject prices and groups</label>
      <Button onClick={save} disabled={!ready || busy}>{busy ? "Saving…" : "Save class pricing"}</Button>
      <div className="space-y-3"><h3 className="font-semibold">Subject pricing and groups</h3><p className="text-xs text-muted-foreground">Empty group membership means a common subject available to every group. Each subject change saves immediately. A specific price overrides normal/special pricing.</p>
        {subjects.filter(s => s.class_id === form.class_id).map(s => { const config = subjectSettings.find(p => p.subject_id === s.id); return <div key={s.id} className="rounded-lg border p-4 space-y-3">
          <p className="font-medium">{s.name} <span className="text-xs text-muted-foreground">ID {s.id}</span></p>
          <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={config?.is_special ?? false} onChange={e => void saveSubject(s,{ is_special:e.target.checked })} />Special subject</label><label className="flex items-center gap-2"><input type="checkbox" checked={config?.is_active ?? true} onChange={e => void saveSubject(s,{ is_active:e.target.checked })} />Active</label>
            {form.groups.map(g => <label key={g} className="flex items-center gap-2"><input type="checkbox" checked={config?.groups.includes(g) || false} onChange={e => void saveSubject(s,{ groups:e.target.checked ? [...(config?.groups || []),g] : (config?.groups || []).filter(x => x !== g) })} />{g}</label>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs">Specific annual price (optional)<Input key={`${s.id}-${config?.individual_price}`} defaultValue={config?.individual_price ?? ""} type="number" min="0.01" step="0.01" onBlur={e => { const value=e.target.value === "" ? null : Number(e.target.value); if (value !== null && (!Number.isFinite(value) || value<=0)) { toast.error("Enter a positive price"); return; } if (value !== (config?.individual_price ?? null)) void saveSubject(s,{individual_price:value}); }} /></label><label className="space-y-1 text-xs">Subject display order<Input key={`${s.id}-order-${config?.sort_order}`} defaultValue={config?.sort_order ?? 0} type="number" onBlur={e => { const value=Number(e.target.value); if (value !== (config?.sort_order ?? 0)) void saveSubject(s,{sort_order:value}); }} /></label></div>
        </div>; })}
      </div>
    </>}
  </CardContent></Card>;
}
