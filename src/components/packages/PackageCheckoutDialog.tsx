import InlineCheckout, { type SelectedPackageItem } from "@/components/InlineCheckout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; selectedPackages: SelectedPackageItem[]; onRemove: (id: number) => void; onClearAll: () => void }
export default function PackageCheckoutDialog({open,onOpenChange,selectedPackages,onRemove,onClearAll}:Props) {
  return <Dialog open={open && selectedPackages.length>0} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%_-_24px)] max-w-3xl flex-col overflow-hidden rounded-xl p-0">
      <DialogHeader className="shrink-0 border-b bg-slate-50 px-5 py-4 text-left"><DialogTitle className="font-heading text-[#0A1E38]">প্যাকেজ চেকআউট</DialogTitle><DialogDescription>নির্বাচিত প্যাকেজ ও পেমেন্টের তথ্য নিশ্চিত করুন।</DialogDescription></DialogHeader>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5"><InlineCheckout key={JSON.stringify(selectedPackages)} selectedPackages={selectedPackages} onRemove={onRemove} onClearAll={onClearAll} /></div>
    </DialogContent>
  </Dialog>;
}
