import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, ShoppingCart, X, Trash2 } from "lucide-react";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";
import logoImg from "@/assets/logo.png";
import bkashLogo from "@/assets/bkash-logo.webp";
import nagadLogo from "@/assets/nagad-logo.png";
import rocketLogo from "@/assets/rocket-logo.png";
import upayLogo from "@/assets/upay-logo.webp";

const BKASH_NUMBER = "01933520904";
const WHATSAPP_NUMBER = "8801340345787";

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

export default function InlineCheckout({ selectedPackages, onRemove, onClearAll, onSuccess }: InlineCheckoutProps) {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [institute, setInstitute] = useState("");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const totalPackagePrice = selectedPackages.reduce((sum, p) => sum + p.price, 0);
  const totalPrice = Math.max(0, totalPackagePrice - discount);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    setName(meta?.full_name || meta?.name || "");
    setEmail(user.email || "");
    supabase.from("institutes").select("name, phone").eq("owner_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setInstitute(data.name || "");
        setPhone(data.phone || "");
      }
    });
  }, [user]);

  const copyNumber = () => {
    navigator.clipboard.writeText(BKASH_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !institute.trim()) {
      toast.error("সকল তথ্য পূরণ করুন");
      return;
    }
    if (!paymentMethod) {
      toast.error("পেমেন্ট মেথড সিলেক্ট করুন");
      return;
    }
    if (!transactionId.trim()) {
      toast.error("যে নাম্বার থেকে টাকা পাঠিয়েছেন সেটি লিখুন");
      return;
    }

    setSubmitting(true);
    try {
      // Build summary strings
      const classNames = [...new Set(selectedPackages.map(p => p.class_name))].join(", ");
      const subjectNames = selectedPackages.map(p => `${p.class_name} - ${p.subject_name}`).join(", ");

      const { data, error } = await supabase.functions.invoke("submit-purchase", {
        body: {
          logged_in_user_id: user?.id || null,
          teacher_name: name.trim(),
          teacher_email: email.trim(),
          teacher_phone: phone.trim(),
          institute_name: institute.trim(),
          package_name: subjectNames,
          package_classes: classNames,
          package_price: totalPackagePrice,
          coupon_code: couponApplied ? coupon.trim().toUpperCase() : "",
          discount,
          total_price: totalPrice,
          payment_method: paymentMethod,
          transaction_id: transactionId.trim(),
          selected_packages: selectedPackages.map(p => ({
            id: p.id,
            class_name: p.class_name,
            subject_name: p.subject_name,
            price: p.price,
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
      toast.success("আপনার রিকুয়েস্ট সফলভাবে জমা হয়েছে!");
      onSuccess?.();
    } catch (err: any) {
      toast.error("সমস্যা হয়েছে: " + (err.message || "আবার চেষ্টা করুন"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-card rounded-2xl shadow-card p-10 text-center">
        <Check className="w-16 h-16 text-primary mx-auto mb-4" />
        <h2 className="font-heading text-2xl font-bold text-foreground mb-2">রিকুয়েস্ট জমা হয়েছে!</h2>
        <p className="text-muted-foreground text-sm mb-6">
          আপনার পেমেন্ট যাচাই করার পর প্যাকেজ সক্রিয় করা হবে। সাধারণত ১-২ ঘণ্টার মধ্যে প্রক্রিয়া সম্পন্ন হয়।
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/pricing">
            <Button variant="outline">মূল্য তালিকায় ফিরুন</Button>
          </Link>
          <Link to="/dashboard">
            <Button className="gradient-green text-white border-0">ড্যাশবোর্ড</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (selectedPackages.length === 0) return null;

  return (
    <div className="space-y-0">
      {/* Header */}
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

      {/* Selected packages list */}
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

      {/* Checkout Info */}
      <div className="bg-card border border-b-0 p-6">
        <h3 className="font-heading text-lg font-bold text-center mb-4">চেক আউট তথ্য</h3>
        <div className="border rounded-lg overflow-hidden text-sm">
          <div className="flex justify-between px-4 py-2 border-b">
            <span className="text-muted-foreground">সেবার ধরণ -</span>
            <span>প্রশ্ন তৈরীর সফটওয়্যার</span>
          </div>
          <div className="flex justify-between px-4 py-2 border-b">
            <span className="text-muted-foreground">প্যাকেজ সংখ্যা -</span>
            <span>{toBengaliDigits(selectedPackages.length)} টি</span>
          </div>
          <div className="flex justify-between px-4 py-2 border-b">
            <span className="text-muted-foreground">মেয়াদ -</span>
            <span>১ বছর</span>
          </div>
          <div className="flex justify-between px-4 py-2 border-b">
            <span className="text-muted-foreground">মূল্য -</span>
            <span>{toBengaliDigits(totalPackagePrice)} টাকা</span>
          </div>
          <div className="flex justify-between px-4 py-2 border-b">
            <span className="text-muted-foreground">ডিসকাউন্ট -</span>
            <span>{toBengaliDigits(discount)} টাকা</span>
          </div>
          <div className="flex justify-between px-4 py-2 font-bold text-primary">
            <span>সর্বমোট মূল্য -</span>
            <span>{toBengaliDigits(totalPrice)} টাকা</span>
          </div>
        </div>
      </div>

      {/* User Info Form */}
      <div className="bg-card border border-b-0 p-6 space-y-3">
        <Input placeholder="আপনার নাম ....." value={name} onChange={(e) => setName(e.target.value)} className="bg-muted/30" readOnly={!!user} />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="মোবাইল নাম্বার দিন" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-muted/30" />
          <Input placeholder="জিমেইল দিন ..." type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-muted/30" readOnly={!!user} />
        </div>
        <Input placeholder="প্রতিষ্ঠানের নাম" value={institute} onChange={(e) => setInstitute(e.target.value)} className="bg-muted/30" />

        {/* Send Money */}
        <p className="text-sm text-muted-foreground pt-2">সেন্ড মানি করুন ...... বিকাশ/নগদ/রকেট/উপায়</p>
        <div className="flex items-center rounded-lg overflow-hidden border border-primary/30 bg-primary/10">
          <span className="flex-1 px-4 py-3 font-mono text-lg font-bold text-foreground select-all">{BKASH_NUMBER}</span>
          <Button variant="ghost" className="h-full px-4 rounded-none bg-primary/20 hover:bg-primary/30 text-primary font-bold" onClick={copyNumber}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "কপি হয়েছে" : "COPY"}
          </Button>
        </div>

        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger className="bg-muted/30">
            <SelectValue placeholder="কোনটাতে সেন্ড করেছেন?" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bkash"><span className="flex items-center gap-2"><img src={bkashLogo} alt="bKash" className="h-4 object-contain" /> বিকাশ</span></SelectItem>
            <SelectItem value="nagad"><span className="flex items-center gap-2"><img src={nagadLogo} alt="Nagad" className="h-4 object-contain" /> নগদ</span></SelectItem>
            <SelectItem value="rocket"><span className="flex items-center gap-2"><img src={rocketLogo} alt="Rocket" className="h-4 object-contain" /> রকেট</span></SelectItem>
            <SelectItem value="upay"><span className="flex items-center gap-2"><img src={upayLogo} alt="Upay" className="h-4 object-contain" /> উপায়</span></SelectItem>
          </SelectContent>
        </Select>

        {paymentMethod && (
          <Input placeholder="যে নাম্বার থেকে টাকা পাঠিয়েছেন সেটি লিখুন" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="bg-muted/30" />
        )}

        {/* Coupon */}
        <div className="flex gap-2">
          <Input
            placeholder="কুপন কোড (যদি থাকে)"
            value={coupon}
            onChange={(e) => { setCoupon(e.target.value); setCouponApplied(false); setDiscount(0); }}
            className="flex-1 bg-muted/30"
            disabled={couponApplied}
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
                } else {
                  disc = c.discount_value;
                }
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

        <Button className="w-full gradient-green text-white border-0 font-heading text-lg h-12 rounded-xl" onClick={handleSubmit} disabled={submitting}>
          <ShoppingCart className="w-5 h-5 mr-2" />
          {submitting ? "জমা হচ্ছে..." : `৳${toBengaliDigits(totalPrice)} — এখনই কিনুন`}
        </Button>

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
          <Button className="gradient-green text-white border-0 font-heading rounded-xl h-11 px-8" asChild>
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
