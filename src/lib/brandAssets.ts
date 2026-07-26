/**
 * Brand images hosted on Cloudinary (absolute URLs).
 *
 * These MUST be absolute CDN URLs so they load identically on the Lovable
 * preview, the Lovable published site, and the self-hosted Vercel deployment.
 * (Relative /__l5e/ asset URLs only resolve on Lovable infrastructure and 404
 * on Vercel, which showed broken icons in the header/footer.)
 */
const CLOUDINARY_BASE = "https://res.cloudinary.com/oez8bzwt/image/upload";

/** Circular gold flask + question-mark brand mark */
export const brandMarkUrl = `${CLOUDINARY_BASE}/f_auto,q_auto,w_224/v1785074557/brand/proshnolab-mark.png`;

/** Small question-paper icon used inside CTA buttons */
export const questionPaperIconUrl = `${CLOUDINARY_BASE}/f_auto,q_auto,w_80/v1785074558/brand/proshnolab-question-paper-icon.png`;
