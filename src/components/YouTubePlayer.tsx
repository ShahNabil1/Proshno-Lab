import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw } from "lucide-react";

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/live\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}

let apiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

interface Props {
  videoId: string;
  title?: string;
  /** Autoplay when the player scrolls into view */
  autoPlayOnView?: boolean;
}

export default function YouTubePlayer({ videoId, title = "ভিডিও", autoPlayOnView = true }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Create player
  useEffect(() => {
    let destroyed = false;
    if (!videoId) return;
    loadYouTubeApi().then((YT) => {
      if (destroyed || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          controls: 0, modestbranding: 1, rel: 0, playsinline: 1,
          disablekb: 1, iv_load_policy: 3, fs: 0,
        },
        events: {
          onReady: (e: any) => {
            setDuration(e.target.getDuration() || 0);
            setMuted(e.target.isMuted?.() ?? true);
            setReady(true);
          },
          onStateChange: (e: any) => {
            const S = (window as any).YT.PlayerState;
            setPlaying(e.data === S.PLAYING);
            if (e.data === S.PLAYING) { setStarted(true); setEnded(false); }
            if (e.data === S.ENDED) setEnded(true);
            const d = playerRef.current?.getDuration?.() || 0;
            if (d) setDuration(d);
          },
        },
      });
    });
    return () => {
      destroyed = true;
      try { playerRef.current?.destroy?.(); } catch { /* noop */ }
      playerRef.current = null;
    };
  }, [videoId]);

  // Progress ticker
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const t = p.getCurrentTime() || 0;
      const d = p.getDuration() || 0;
      setCurrent(t);
      if (d) { setDuration(d); setProgress((t / d) * 100); }
    }, 400);
    return () => window.clearInterval(id);
  }, [ready]);

  // Autoplay when scrolled into view — try with sound, fall back to muted
  useEffect(() => {
    if (!ready || !autoPlayOnView || !wrapRef.current) return;
    const el = wrapRef.current;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      const p = playerRef.current;
      if (!p) return;
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        if (!started) {
          try { p.unMute(); p.setVolume(80); } catch { /* noop */ }
          p.playVideo();
          // If the browser blocked unmuted autoplay, retry muted
          window.setTimeout(() => {
            const state = p.getPlayerState?.();
            if (state !== 1) {
              try { p.mute(); } catch { /* noop */ }
              setMuted(true);
              p.playVideo();
            } else {
              setMuted(p.isMuted?.() ?? false);
            }
          }, 700);
        }
      } else if (!entry.isIntersecting) {
        p.pauseVideo?.();
      }
    }, { threshold: [0, 0.5, 0.75] });
    io.observe(el);
    return () => io.disconnect();
  }, [ready, autoPlayOnView, started]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }, [playing]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) { p.unMute(); p.setVolume(80); setMuted(false); }
    else { p.mute(); setMuted(true); }
  }, []);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = playerRef.current;
    if (!p || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    p.seekTo(duration * ratio, true);
  };

  const goFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const restart = () => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(0, true);
    p.playVideo();
  };

  return (
    <div
      ref={wrapRef}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
      className="group relative w-full overflow-hidden rounded-2xl border border-border bg-navy shadow-premium"
    >
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
        {/* Scale the iframe up so YouTube's own chrome (logo, title, share,
            watch-later, "More videos" strip) falls outside the visible frame */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[124%] w-[124%] -translate-x-1/2 -translate-y-1/2"
        >
          <div ref={hostRef} className="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
        </div>

        {/* click-catcher so native YouTube UI never takes over */}
        <button
          type="button"
          aria-label={playing ? "পজ" : "প্লে"}
          onClick={togglePlay}
          className="absolute inset-0 h-full w-full cursor-pointer bg-transparent"
        />


        {/* Big center play / replay */}
        {(!playing || ended) && (
          <button
            type="button"
            onClick={ended ? restart : togglePlay}
            aria-label={ended ? "আবার দেখুন" : "প্লে"}
            className="pointer-events-auto absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gold text-navy shadow-lg transition-transform hover:scale-110 md:h-20 md:w-20"
          >
            {ended ? <RotateCcw className="h-7 w-7 md:h-8 md:w-8" /> : <Play className="ml-1 h-7 w-7 fill-current md:h-9 md:w-9" />}
          </button>
        )}

        {/* Unmute nudge */}
        {playing && muted && (
          <button
            type="button"
            onClick={toggleMute}
            className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-navy shadow-lg transition hover:brightness-95 md:text-sm"
          >
            <VolumeX className="h-4 w-4" /> সাউন্ড চালু করুন
          </button>
        )}

        {/* Custom control bar */}
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/95 via-navy/70 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-300 md:px-4 ${
            showControls || !playing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <div
            onClick={seek}
            className="mb-2 h-1.5 w-full cursor-pointer rounded-full bg-white/25 transition-all hover:h-2"
          >
            <div className="relative h-full rounded-full bg-gold" style={{ width: `${progress}%` }}>
              <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-gold opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>

          <div className="flex items-center gap-3 text-white">
            <button type="button" onClick={togglePlay} aria-label={playing ? "পজ" : "প্লে"} className="transition hover:text-gold">
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>
            <button type="button" onClick={toggleMute} aria-label={muted ? "আনমিউট" : "মিউট"} className="transition hover:text-gold">
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="font-body text-xs tabular-nums text-white/85 md:text-sm">
              {fmt(current)} / {fmt(duration)}
            </span>
            <span className="ml-auto truncate text-xs text-white/70 md:text-sm">{title}</span>
            <button type="button" onClick={goFullscreen} aria-label="ফুলস্ক্রিন" className="transition hover:text-gold">
              <Maximize2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
