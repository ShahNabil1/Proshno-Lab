import BrandLogo from "@/components/BrandLogo";
import { brandMarkDarkUrl } from "@/lib/brandAssets";

/** Font-rendered wordmark with a proportionally sized symbol on dark surfaces. */
export default function BrandLockup({ size = 40 }: { size?: number }) {
  return <span className="inline-flex shrink-0 items-center" style={{ gap: size * 0.14 }}>
    <img src={brandMarkDarkUrl} alt="" aria-hidden="true" style={{ width: size * 1.4, height: size * 1.22 }} className="shrink-0 object-contain" />
    <BrandLogo size={size} className="[&_.text-brand-navy]:text-white" />
  </span>;
}
