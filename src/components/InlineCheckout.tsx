import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isNoPackagePreview } from "@/lib/adminExperiencePreview";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, ShoppingCart, X, Trash2, Loader2 } from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import logoImg from "@/assets/logo.png";
import bkashLogo from "@/assets/bkash-logo.webp";
import { normalizeBdPhone, isValidBdPhone, BD_PHONE_ERROR } from "@/lib/phone";

const WHATSAPP_NUMBER = "8801758018668";

export interface SelectedPackageItem {
  id: number;
  class_name: string;
  subject_name: string;
  price: number;
}

interface InlineCheckoutProps {
  selectedPackages: SelectedPackageItem[];
  onRemove: (id: number) => void;
  onClearAll: () => void;
  onSuccess?: () => void;
}

function toBengaliDigits(n: number): string {
  const bengaliDigits = "০১২৩৪৫৬৭৮৯";
  return n.toLocaleString("en-IN").replace(/\d/g, (d) => bengaliDigits[parseInt(d)]);
}

export default function InlineCheckout({ selectedPackages, onRemove, onClearAll }: InlineCheckoutProps) {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [institute, setInstitute] = useState("");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalPackagePrice = selectedPackages.reduce((sum, p) => sum + p.price, 0);
  const totalPrice = Math.max(0, totalPackagePrice - discount);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    setName(meta?.full_name || meta?.name || "");
    setEmail(user.email || "");
    supabase.from("institutes").select("name, phone").eq("owner_id", user.id).order("id", { ascending: true }).limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setInstitute(data.name || "");
        setPhone(data.phone || "");
      }
    });
  }, [user]);

  const sanitizeEmail = (v: string) =>
    v.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "").toLowerCase();
  const sanitizeCoupon = (v: string) =>
    v.replace(/[^\x00-\x7F]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const isGmail = (v: string) => /^[a-z0-9._%+-]+@gmail\.com$/.test(v.trim().toLowerCase());

  const handlePay = async () => {
    if (isNoPackagePreview(user?.id)) {
      toast.info("পরীক্ষামূলক মোডে আসল পেমেন্ট চালু হবে না। পেমেন্ট করতে পরীক্ষা বন্ধ করুন।");
      return;
    }
    if (!user) { toast.error("প্রথমে লগইন করুন"); return; }
    if (!name.trim() || !email.trim() || !phone.trim() || !institute.trim()) {
      toast.error("সকল তথ্য পূরণ করুন"); return;
    }
    if (!isGmail(email)) { toast.error("শুধুমাত্র বৈধ @gmail.com ইমেইল ইংরেজিতে দিন"); return; }
    if (!isValidBdPhone(phone)) { toast.error(BD_PHONE_ERROR); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("bkash-create-payment", {
        body: {
          selected_packages: selectedPackages.map(p => ({ id: p.id, class_name: p.class_name, subject_name: p.subject_name, price: p.price })),
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

  if (selectedPackages.length === 0) return null;

  return (
    <div className="space-y-0">
      <div className="bg-card rounded-t-2xl border border-b-0 p-6 text-center">
        <img src={logoImg} alt="Proshno Lab" className="w-12 h-12 rounded-xl mx-auto mb-3 object-contain" />
        <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-primary">
          প্রশ্ন তৈরির — স্মার্ট প্যাকেজ !!!
        </h2>
        <div className="flex justify-between text-sm text-muted-foreground mt-4">
          <span>মেয়াদ — ১ বছর</span>
          <span>লিমিট — আনলিমিটেড প্রশ্ন তৈরি</span>
        </div>
      </div>

      <div className="bg-card border border-b-0 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold">নির্বাচিত প্যাকেজসমূহ</h3>
          <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={onClearAll}>
            <Trash2 className="w-3 h-3 mr-1" /> সব সরান
          </Button>
        </div>
        <div className="space-y-2">
          {selectedPackages.map((pkg) => (
            <div key={pkg.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5">
              <div>
                <span className="text-sm font-medium">{pkg.class_name}</span>
                <span className="text-muted-foreground mx-2">—</span>
                <span className="text-sm">{pkg.subject_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">৳{toBengaliDigits(pkg.price)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(pkg.id)}>
                  <X className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-b-0 p-6">
        <h3 className="font-heading text-lg font-bold text-center mb-4">চেক আউট তথ্য</h3>
        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="flex justify-between px-4 py-2 border-b"><span className="text-muted-foreground">সেবার ধরণ -</span><span>প্রশ্ন তৈরীর সফটওয়্যার</span></div>
          <div className="flex justify-between px-4 py-2 border-b"><span className="text-muted-foreground">প্যাকেজ সংখ্যা -</span><span>{toBengaliDigits(selectedPackages.length)} টি</span></div>
          <div className="flex justify-between px-4 py-2 border-b"><span className="text-muted-foreground">মেয়াদ -</span><span>১ বছর</span></div>
          <div className="flex justify-between px-4 py-2 border-b"><span className="text-muted-foreground">মূল্য -</span><span>{toBengaliDigits(totalPackagePrice)} টাকা</span></div>
          <div className="flex justify-between px-4 py-2 border-b"><span className="text-muted-foreground">ডিসকাউন্ট -</span><span>{toBengaliDigits(discount)} টাকা</span></div>
          <div className="flex justify-between px-4 py-2 font-bold text-primary"><span>সর্বমোট মূল্য -</span><span>{toBengaliDigits(totalPrice)} টাকা</span></div>
        </div>
      </div>

      <div className="bg-card border border-b-0 p-6 space-y-3">
        <Input placeholder="আপনার নাম ....." value={name} onChange={(e) => setName(e.target.value)} className="bg-muted/30" readOnly={!!user} />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="মোবাইল নাম্বার দিন" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(normalizeBdPhone(e.target.value))} className="bg-muted/30" />
          <Input placeholder="আপনার gmail ঠিকানা" type="email" inputMode="email" value={email} onChange={(e) => setEmail(sanitizeEmail(e.target.value))} className="bg-muted/30" readOnly={!!user} autoComplete="email" />
        </div>
        <Input placeholder="প্রতিষ্ঠানের নাম" value={institute} onChange={(e) => setInstitute(e.target.value)} className="bg-muted/30" />

        {/* Coupon */}
        <div className="flex gap-2">
          <Input
            placeholder="কুপন কোড (যদি থাকে)"
            value={coupon}
            onChange={(e) => { setCoupon(sanitizeCoupon(e.target.value)); setCouponApplied(false); setDiscount(0); }}
            className="flex-1 bg-muted/30 uppercase tracking-wider"
            disabled={couponApplied}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
          />
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
                if (totalPackagePrice < c.min_purchase) { toast.error(`ন্যূনতম ক্রয় ৳${c.min_purchase} প্রয়োজন`); return; }
                let disc = 0;
                if (c.discount_type === "percentage") {
                  disc = Math.round(totalPackagePrice * c.discount_value / 100);
                  if (c.max_discount && disc > c.max_discount) disc = c.max_discount;
                } else { disc = c.discount_value; }
                disc = Math.min(disc, totalPackagePrice);
                setDiscount(disc);
                setCouponApplied(true);
                toast.success(`কুপন প্রয়োগ হয়েছে! ৳${disc} ডিসকাউন্ট`);
              } catch { toast.error("সমস্যা হয়েছে"); } finally { setCouponLoading(false); }
            }}>
              {couponLoading ? "যাচাই..." : "প্রয়োগ করুন"}
            </Button>
          )}
        </div>
        {couponApplied && <p className="text-xs text-primary font-medium">✅ কুপন "{coupon.toUpperCase()}" প্রয়োগ হয়েছে — ৳{discount} ডিসকাউন্ট</p>}

        <p className="text-xs text-center text-muted-foreground pt-1">
          By confirming, I agree to the{" "}
          <Link to="/terms" className="text-primary hover:underline">Terms and Conditions</Link>
          {" "}and{" "}
          <Link to="/refund" className="text-primary hover:underline">Refund Policy</Link>.
        </p>

        <Button
          className="w-full bg-[#e2136e] hover:bg-[#c1105e] text-white border-0 font-heading text-lg h-14 rounded-xl"
          onClick={handlePay}
          disabled={submitting}
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> রিডাইরেক্ট হচ্ছে…</>
          ) : (
            <>
              <img src={bkashLogo} alt="bKash" className="h-6 mr-2 bg-white rounded px-1" />
              বিকাশে ৳{toBengaliDigits(totalPrice)} পরিশোধ করুন
            </>
          )}
        </Button>
        <p className="text-[11px] text-center text-muted-foreground">
          সিকিউর বিকাশ চেকআউট — PIN ও OTP দিয়ে পেমেন্ট সম্পন্ন হবে, সাথে সাথে সাবস্ক্রিপশন সক্রিয় হবে।
        </p>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-center">
          <p className="font-heading font-bold text-primary text-sm mb-1">
            হোয়াটসঅ্যাপে যোগাযোগ করে প্যাকেজ নেয়ার জন্য নিচের বাটনে ক্লিক করুন।
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            (আমি প্যাকেজের বিস্তারিত পড়েছি এবং{" "}
            <Link to="/terms" className="text-primary hover:underline">শর্তাবলীতে</Link> সম্মত হয়েছি)
          </p>
          <Button className="bg-[#25D366] hover:bg-[#128C7E] text-white border-0 font-heading rounded-xl h-11 px-8" asChild>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`আমি ${selectedPackages.map(p => `${p.class_name} - ${p.subject_name}`).join(", ")} প্যাকেজ কিনতে চাই।`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon />
              WhatsApp এ যোগাযোগ করুন
            </a>
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-b-2xl border border-t-0 p-4" />
    </div>
  );
}
