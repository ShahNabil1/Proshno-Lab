import brandSymbolDarkUrl from "@/assets/brand-symbol-dark.svg";
import brandSymbolUrl from "@/assets/brand-symbol.svg";
/**
 * Brand images hosted on Cloudinary (absolute URLs).
 *
 * These MUST be absolute CDN URLs so they load identically on the Lovable
 * preview, the Lovable published site, and the self-hosted Vercel deployment.
 * (Relative /__l5e/ asset URLs only resolve on Lovable infrastructure and 404
 * on Vercel, which showed broken icons in the header/footer.)
 */
const CLOUDINARY_BASE = "https://res.cloudinary.com/oez8bzwt/image/upload";

/** Navy and teal brand symbol; wordmark remains font-rendered. */
export const brandMarkUrl = brandSymbolUrl;
export const brandMarkDarkUrl = brandSymbolDarkUrl;

/** Small question-paper icon used inside CTA buttons */
export const questionPaperIconUrl = `${CLOUDINARY_BASE}/f_auto,q_auto,w_80/v1785074558/brand/proshnolab-question-paper-icon.png`;
