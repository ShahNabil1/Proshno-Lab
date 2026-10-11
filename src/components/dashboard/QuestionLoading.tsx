import BrandLogo from "@/components/BrandLogo";
import { brandMarkUrl } from "@/lib/brandAssets";

export default function QuestionLoading() {
  return <div className="question-loading-overlay" role="status" aria-label="Loading" aria-live="polite">
    <div className="question-loading-stage">
      <div className="question-loading-panel">
        <div className="question-loading-logo"><img src={brandMarkUrl} alt="" aria-hidden="true" className="h-8 w-9 object-contain" /><BrandLogo size={24} /></div>
        <p className="question-loading-caption">Loading<span className="text-[#00858C]">…</span></p>
      </div>
    </div>
  </div>;
}
