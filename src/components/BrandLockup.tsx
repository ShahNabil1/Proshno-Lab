import BrandLogo from "@/components/BrandLogo";
import { brandMarkDarkUrl, brandMarkUrl } from "@/lib/brandAssets";

/** Font-rendered wordmark with a proportionally sized symbol on dark surfaces. */
export default function BrandLockup({ size = 40, dark = true }: { size?: number; dark?: boolean }) {
  return <span className="inline-flex shrink-0 items-center" style={{ gap: size * 0.14 }}>
    <img src={dark ? brandMarkDarkUrl : brandMarkUrl} alt="" aria-hidden="true" style={{ width: size * 1.4, height: size * 1.22 }} className="shrink-0 object-contain" />
    <BrandLogo size={size} className={dark ? "[&_.text-brand-navy]:text-white" : undefined} />
  </span>;
}
