import { cn } from "@/lib/utils";

type Props = {
  /** Font size in px for the wordmark */
  size?: number;
  /** Show the navy plate behind the wordmark (matches the official logo lockup) */
  plate?: boolean;
  className?: string;
};

/**
 * Official Proshno Lab wordmark.
 * Font: HasanHera (lipighor.com) — loaded via @font-face in index.css.
 * Colours are locked to the brand logo: navy #102E56 plate, white "প্রশ্ন", gold #00B4BC "ল্যাব".
 */
export default function BrandLogo({ size = 34, plate = false, className }: Props) {
  return (
    <span
      className={cn(
        "brand-logo inline-flex items-center leading-none",
        plate && "brand-logo-plate",
        className
      )}
      style={{ fontSize: size }}
      aria-label="প্রশ্নল্যাব"
    >
      <span className={plate ? "text-brand-onplate" : "text-brand-navy"}>প্রশ্ন</span>
      <span className="text-brand-teal">ল্যাব</span>
    </span>
  );
}
