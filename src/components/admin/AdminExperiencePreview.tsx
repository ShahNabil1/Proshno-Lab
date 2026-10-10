import { useAuth } from "@/contexts/AuthContext";
import { setNoPackagePreview, useNoPackagePreview } from "@/lib/adminExperiencePreview";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

export default function AdminExperiencePreview({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  const active = useNoPackagePreview(user?.id);
  if (!user || (!admin && !active)) return null;
  return <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
    {active && <span className="inline-flex items-center gap-1.5 text-xs text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />প্যাকেজহীন ব্যবহারকারীর পরীক্ষা</span>}
    <Button variant="outline" size="sm"
      title="শুধু এই ট্যাবে প্যাকেজ ছাড়া ব্যবহারকারীর অভিজ্ঞতা দেখুন। আসল প্যাকেজ ও অনুমতি বদলাবে না।"
      className={`h-8 gap-1.5 rounded-full px-3 text-xs font-medium shadow-none transition-colors ${active ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"}`}
      onClick={() => {
      setNoPackagePreview(user.id, !active);
      window.location.assign(active ? "/admin" : "/dashboard");
    }}>{active ? <X className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{active ? "পরীক্ষা বন্ধ" : "ইউজার ভিউ"}</Button>
  </div>;
}
