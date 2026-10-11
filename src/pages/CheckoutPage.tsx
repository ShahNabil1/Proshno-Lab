import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShoppingCart, Loader2 } from "lucide-react";
import logoImg from "@/assets/logo.png";
import bkashLogo from "@/assets/bkash-logo.webp";
import { normalizeBdPhone, isValidBdPhone, BD_PHONE_ERROR } from "@/lib/phone";

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const packageIdParam = params.get("id");
  const packageName = params.get("package") || "";
  const packageClasses = params.get("classes") || "";
  const packageSubject = params.get("subject") || "";
  const packagePrice = parseInt(params.get("price") || "0", 10);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [institute, setInstitute] = useState("");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [resolvedId, setResolvedId] = useState<number | null>(packageIdParam ? Number(packageIdParam) : null);

  const totalPrice = Math.max(0, packagePrice - discount);
  useEffect(() => {
    if (!resolvedId) return;
    supabase.from("pricing_packages").select("duration_days").eq("id", resolvedId).maybeSingle()
      .then(({ data }) => setDurationDays(data?.duration_days ?? null));
  }, [resolvedId]);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    setName(meta?.full_name || meta?.name || "");
    setEmail(user.email || "");
      supabase.from("institutes").select("name, phone").eq("owner_id", user.id).order("id", { ascending: true }).limit(1).maybeSingle().then(({ data }) => {
      if (data) { setInstitute(data.name || ""); setPhone(data.phone || ""); }
    });
  }, [user]);

  useEffect(() => {
    if (resolvedId || !packageClasses || !packageSubject) return;
    supabase.from("pricing_packages").select("id").eq("class_name", packageClasses).eq("subject_name", packageSubject).eq("is_active", true).maybeSingle()
      .then(({ data }) => { if (data) setResolvedId((data as any).id); });
  }, [resolvedId, packageClasses, packageSubject]);

  useEffect(() => {
    if (packageSubject !== "সকল বিষয়" || !packageClasses) { setAllSubjects([]); return; }
    supabase.from("pricing_packages").select("subject_name").eq("class_name", packageClasses).eq("type", "class").eq("is_active", true).neq("subject_name", "সকল বিষয়").order("sort_order")
      .then(({ data }) => setAllSubjects(data?.map((d: any) => d.subject_name) ?? []));
  }, [packageClasses, packageSubject]);

  const handlePay = async () => {
    if (!user) { toast.error("প্রথমে লগইন করুন"); return; }
    if (!name.trim() || !email.trim() || !phone.trim() || !institute.trim()) { toast.error("সকল তথ্য পূরণ করুন"); return; }
    if (!isValidBdPhone(phone)) { toast.error(BD_PHONE_ERROR); return; }
    if (!resolvedId) { toast.error("প্যাকেজ পাওয়া যায়নি"); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bkash-create-payment", {
        body: {
          selected_packages: [{ id: resolvedId, class_name: packageClasses, subject_name: packageSubject || packageName, price: packagePrice }],
          coupon_code: couponApplied ? coupon.trim().toUpperCase() : undefined,
          phone: phone.trim(),
          institute_name: institute.trim(),
          teacher_name: name.trim(),
          callback_origin: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.bkashURL) throw new Error("bKash URL পাওয়া যায়নি");
      window.location.href = data.bkashURL;
    } catch (err: any) {
      toast.error("সমস্যা হয়েছে: " + (err.message || "আবার চেষ্টা করুন"));
      setSubmitting(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="py-10 pt-28">
      <div className="container max-w-2xl">
        <div className="bg-card rounded-t-2xl border border-b-0 p-6 text-center">
          <img src={logoImg} alt="Proshno Lab" className="w-12 h-12 rounded-xl mx-auto mb-3 object-contain" />
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-primary">প্রশ্ন তৈরির — স্মার্ট প্যাকেজ !!!</h1>
          <div className="flex justify-between text-sm text-muted-foreground mt-4">
            <span>মেয়াদ — {durationDays ? `${durationDays.toLocaleString("bn-BD")} দিন` : "১ বছর"}</span>
            <span>লিমিট — আনলিমিটেড প্রশ্ন তৈরি</span>
          </div>
        </div>

        <div className="bg-card border border-b-0 p-6 text-center">
          <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground">{packageClasses} শ্রেণির প্যাকেজ</h2>
          <p className="font-heading text-lg font-semibold text-primary mt-1">মূল্য: {packagePrice} টাকা</p>
          {packageSubject && (
            <div className="mt-3 bg-muted/50 rounded-lg p-3 text-left">
              <p className="text-sm font-semibold text-muted-foreground">বিষয়সমূহ: {packageClasses}</p>
              {packageSubject === "সকল বিষয়" && allSubjects.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm font-semibold text-primary">• সকল বিষয় (নিচের বিষয়গুলো অন্তর্ভুক্ত):</p>
                  {allSubjects.map((s, i) => <p key={i} className="text-sm ml-4">— {s}</p>)}
                </div>
              ) : (<p className="text-sm mt-1">• {packageSubject}</p>)}
            </div>
          )}
        </div>

        <div className="bg-card border border-b-0 p-6">
          <div className="border rounded-lg overflow-hidden text-sm">
            <div className="flex justify-between px-4 py-2 border-b"><span className="text-muted-foreground">মূল্য -</span><span>{packagePrice} টাকা</span></div>
            <div className="flex justify-between px-4 py-2 border-b"><span className="text-muted-foreground">ডিসকাউন্ট -</span><span>{discount} টাকা</span></div>
            <div className="flex justify-between px-4 py-2 font-bold"><span>সর্বমোট মূল্য -</span><span>{totalPrice} টাকা</span></div>
          </div>
        </div>

        <div className="bg-card border border-b-0 p-6 space-y-3">
          <Input placeholder="আপনার নাম ....." value={name} onChange={(e) => setName(e.target.value)} className="bg-muted/30" readOnly={!!user} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="মোবাইল নাম্বার দিন" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(normalizeBdPhone(e.target.value))} className="bg-muted/30" />
            <Input placeholder="জিমেইল দিন ..." type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-muted/30" readOnly={!!user} />
          </div>
          <Input placeholder="প্রতিষ্ঠানের নাম" value={institute} onChange={(e) => setInstitute(e.target.value)} className="bg-muted/30" />

          <div className="flex gap-2">
            <Input placeholder="কুপন কোড (যদি থাকে)" value={coupon}
              onChange={(e) => { setCoupon(e.target.value); setCouponApplied(false); setDiscount(0); }}
              className="flex-1 bg-muted/30" disabled={couponApplied} />
            {couponApplied ? (
              <Button variant="outline" className="font-heading text-destructive" onClick={() => { setCoupon(""); setCouponApplied(false); setDiscount(0); }}>সরান</Button>
            ) : (
              <Button variant="outline" className="font-heading" disabled={couponLoading || !coupon.trim()} onClick={async () => {
                setCouponLoading(true);
                try {
                  const { data, error } = await supabase.from("coupons").select("*").eq("code", coupon.trim().toUpperCase()).eq("is_active", true).maybeSingle();
                  if (error || !data) { toast.error("কুপন কোড সঠিক নয়"); return; }
                  const c = data as any;
                  if (c.expires_at && new Date(c.expires_at) < new Date()) { toast.error("কুপনের মেয়াদ শেষ"); return; }
                  if (c.use_limit !== null && c.used_count >= c.use_limit) { toast.error("কুপনের ব্যবহার সীমা শেষ"); return; }
                  if (packagePrice < c.min_purchase) { toast.error(`ন্যূনতম ক্রয় ৳${c.min_purchase} প্রয়োজন`); return; }
                  let disc = c.discount_type === "percentage"
                    ? Math.min(Math.round(packagePrice * c.discount_value / 100), c.max_discount || Infinity)
                    : c.discount_value;
                  disc = Math.min(disc, packagePrice);
                  setDiscount(disc); setCouponApplied(true);
                  toast.success(`কুপন প্রয়োগ হয়েছে! ৳${disc} ডিসকাউন্ট`);
                } catch { toast.error("সমস্যা হয়েছে"); } finally { setCouponLoading(false); }
              }}>{couponLoading ? "যাচাই..." : "প্রয়োগ করুন"}</Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground pt-1">
            By confirming, I agree to the <Link to="/terms" className="text-primary hover:underline">Terms and Conditions</Link>
            {" "}and <Link to="/refund" className="text-primary hover:underline">Refund Policy</Link>.
          </p>

          <Button className="w-full bg-[#e2136e] hover:bg-[#c1105e] text-white border-0 font-heading text-lg h-14 rounded-xl" onClick={handlePay} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> রিডাইরেক্ট হচ্ছে…</>
            ) : (
              <><img src={bkashLogo} alt="bKash" className="h-6 mr-2 bg-white rounded px-1" /> বিকাশে ৳{totalPrice} পরিশোধ করুন</>
            )}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">সিকিউর বিকাশ চেকআউট — পেমেন্ট সফল হলে সাথে সাথে সাবস্ক্রিপশন সক্রিয় হবে।</p>
        </div>
      </div>
    </div>
  );
}
