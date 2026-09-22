import { useCallback, useEffect, useState } from "react";
import { engineHealth, type OmrEngineHealth } from "@/lib/omrEngine";
import { loadOpenCv } from "@/lib/omrVision";

interface UseOmrEngineOptions {
  /**
   * Start downloading the in-browser scanner (OpenCV.js, ~10 MB) as soon as the
   * page opens.  Only worth it on the page that actually scans sheets.
   */
  warmVision?: boolean;
}

/**
 * Reports whether OMR work can start.  Sheets are scanned inside the page, so
 * there is nothing for the teacher to install - this only checks the answer-key
 * store and, when asked, preloads the vision runtime.
 */
export function useOmrEngine(options: UseOmrEngineOptions = {}) {
  const { warmVision = false } = options;
  const [status, setStatus] = useState<OmrEngineHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [visionReady, setVisionReady] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await engineHealth();
    setStatus(result);
    setLoading(false);
    return result;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!warmVision) return;
    let active = true;
    void loadOpenCv()
      .then(() => {
        if (active) setVisionReady(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [warmVision]);

  return {
    status,
    loading,
    refresh,
    visionReady,
    online: Boolean(status?.ok),
    offline: status ? !status.ok : false,
  };
}
