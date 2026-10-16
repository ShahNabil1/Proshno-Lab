import { brandMarkDarkUrl } from "@/lib/brandAssets";
import BrandLogo from "@/components/BrandLogo";

export default function PaperLoading({ download = false, progress = 0 }: { download?: boolean; progress?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`flex flex-col items-center justify-center px-6 text-center ${download ? "py-8" : "min-h-[65vh]"}`}>
      <div className="relative mb-8 flex h-36 w-36 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-[#00B4BC]/15 motion-safe:animate-ping [animation-duration:3s]" />
        <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-[#00B4BC] border-r-[#00B4BC]/30 motion-safe:animate-spin [animation-duration:2s]" />
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#0A1E38] shadow-[0_12px_36px_-12px_#00B4BC80] motion-safe:animate-pulse [animation-duration:3s]">
          <img src={brandMarkDarkUrl} alt="প্রশ্নল্যাব" className="h-16 w-20 object-contain" />
        </div>
      </div>
      <BrandLogo size={32} className="mb-5" />
      <h2 className="text-xl font-bold text-[#0A1E38] sm:text-2xl">{download ? "আপনার ডাউনলোড প্রস্তুত হচ্ছে…" : "আপনার প্রশ্নপত্র প্রস্তুত হচ্ছে…"}</h2>
      <p className="mt-3 text-sm text-slate-500 sm:text-base">{download ? "প্রশ্নপত্রের পৃষ্ঠাগুলো সাজিয়ে নিচ্ছি" : "প্রশ্নগুলো সাজিয়ে নিচ্ছি, একটু অপেক্ষা করুন"}</p>
      {download && <div className="mt-5 w-full max-w-xs">
        <progress aria-label="ডাউনলোড প্রস্তুতির অগ্রগতি" value={progress} max={100} className="h-2 w-full accent-[#00B4BC]" />
        <p className="mt-1 text-xs text-slate-500">{progress}%</p>
      </div>}
      <div aria-hidden="true" className="mt-6 flex gap-2">
        {[0, 160, 320].map(delay => <span key={delay} className="h-2 w-2 rounded-full bg-[#00B4BC] motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />)}
      </div>
    </div>
  );
}
