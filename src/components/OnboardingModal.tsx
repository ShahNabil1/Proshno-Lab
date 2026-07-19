import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDivisions, getDistricts, getUpazilas } from "@/data/bangladeshGeo";
import { normalizeBdPhone, isValidBdPhone, BD_PHONE_ERROR } from "@/lib/phone";

interface OnboardingModalProps {
  open: boolean;
  onComplete: () => void;
}

export default function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    division: "",
    district: "",
    upazila: "",
    phone: "",
    specific_address: "",
  });

  const divisions = getDivisions();
  const districts = form.division ? getDistricts(form.division) : [];
  const upazilas = form.division && form.district ? getUpazilas(form.division, form.district) : [];

  const handleDivisionChange = (val: string) => {
    setForm(prev => ({ ...prev, division: val, district: "", upazila: "" }));
  };

  const handleDistrictChange = (val: string) => {
    setForm(prev => ({ ...prev, district: val, upazila: "" }));
  };

  const banglaToEnglishDigits = (s: string) =>
    s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

  const handlePhoneChange = (raw: string) => {
    const converted = banglaToEnglishDigits(raw).replace(/\D/g, "").slice(0, 11);
    setForm((prev) => ({ ...prev, phone: converted }));
  };

  const isValidBdPhone = (p: string) => /^01[3-9]\d{8}$/.test(p);

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.name.trim()) { toast.error("প্রতিষ্ঠানের নাম দিন"); return; }
    if (!form.division) { toast.error("বিভাগ নির্বাচন করুন"); return; }
    if (!form.district) { toast.error("জেলা নির্বাচন করুন"); return; }
    if (!form.upazila) { toast.error("উপজেলা নির্বাচন করুন"); return; }
    if (!isValidBdPhone(form.phone)) { toast.error("সঠিক ১১ ডিজিটের বাংলাদেশি ফোন নম্বর দিন (01[3-9]XXXXXXXX)"); return; }

    setLoading(true);
    const { error } = await supabase.from("institutes").insert({
      name: form.name.trim(),
      division: form.division,
      district: form.district,
      upazila: form.upazila,
      phone: form.phone.trim(),
      specific_address: form.specific_address.trim(),
      owner_id: user.id,
    });

    if (error) {
      toast.error("সংরক্ষণ ব্যর্থ হয়েছে");
      setLoading(false);
      return;
    }

    toast.success("রেজিস্ট্রেশন সম্পন্ন হয়েছে!");
    setLoading(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-primary font-heading">
            এক ধাপ বাকি, প্রতিষ্ঠান রেজিস্ট্রেশন করুন
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            ড্যাশবোর্ড ব্যবহার করতে প্রতিষ্ঠানের তথ্য দিন
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div>
            <Label>প্রতিষ্ঠানের নাম *</Label>
            <Input
              placeholder="প্রতিষ্ঠানের নাম"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div>
            <Label>বিভাগ *</Label>
            <Select value={form.division} onValueChange={handleDivisionChange}>
              <SelectTrigger><SelectValue placeholder="বিভাগ" /></SelectTrigger>
              <SelectContent>
                {divisions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>জেলা *</Label>
            <Select value={form.district} onValueChange={handleDistrictChange} disabled={!form.division}>
              <SelectTrigger><SelectValue placeholder="জেলা" /></SelectTrigger>
              <SelectContent>
                {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>উপজেলা *</Label>
            <Select value={form.upazila} onValueChange={(val) => setForm(prev => ({ ...prev, upazila: val }))} disabled={!form.district}>
              <SelectTrigger><SelectValue placeholder="উপজেলা" /></SelectTrigger>
              <SelectContent>
                {upazilas.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>ফোন নম্বর *</Label>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="01XXXXXXXXX"
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              maxLength={11}
            />
          </div>

          <div>
            <Label>নির্দিষ্ট ঠিকানা (যদি থাকে)</Label>
            <Textarea
              placeholder="নির্দিষ্ট ঠিকানা লিখুন (যদি থাকে) | এখানে জেলা বা উপজেলা লিখবেন না।"
              value={form.specific_address}
              onChange={(e) => setForm(prev => ({ ...prev, specific_address: e.target.value }))}
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full gradient-green text-primary-foreground border-0"
          >
            {loading ? "সংরক্ষণ হচ্ছে..." : "রেজিস্টার্ড করুন"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
