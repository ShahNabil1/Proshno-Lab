export interface MarketingContext { source_url: string; fbp?: string; fbc?: string; user_agent: string; }

export function getMarketingContext(): MarketingContext {
  const cookies = Object.fromEntries(document.cookie.split(";").map(part => {
    const at = part.indexOf("=");
    return [part.slice(0, at).trim(), part.slice(at + 1)];
  }));
  const save = (name: string, value: string) => {
    try { document.cookie = `${name}=${value}; Max-Age=7776000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch { /* optional attribution */ }
    return value;
  };
  const fbp = /^fb\.\d+\.\d{13}\.\d+$/.test(cookies._fbp || "") ? cookies._fbp
    : save("_fbp", `fb.1.${Date.now()}.${Math.floor(Math.random() * 2147483647)}`);
  const clickId = new URLSearchParams(location.search).get("fbclid");
  const fbc = clickId && /^[A-Za-z0-9_-]{10,500}$/.test(clickId)
    ? cookies._fbc?.endsWith(`.${clickId}`) ? cookies._fbc : save("_fbc", `fb.1.${Date.now()}.${clickId}`) : cookies._fbc;
  return {
    // Strip queries, payment IDs, email/reset tokens, and fragment state.
    source_url: `${location.origin}${location.pathname}`,
    user_agent: navigator.userAgent.slice(0, 512),
    fbp,
    ...(fbc && /^fb\.\d+\.\d{13}\.[A-Za-z0-9_-]+$/.test(fbc) ? { fbc } : {}),
  };
}
