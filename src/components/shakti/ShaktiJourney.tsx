import { useEffect, useRef, useState } from "react";
import { SiteNav, SiteFooter } from "@/components/aikyam/SiteLayout";
import {
  SHAKTHI_FRAMES,
  TOTAL_FRAMES,
  OVERLAY_SECTIONS,
  SHAKTI_PEETHAS,
} from "./shaktiData";
import "./shakti.css";

// ─── smooth step ─────────────────────────────────────────────────────────────
const sm = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

// ─── preload concurrency ──────────────────────────────────────────────────────
const EAGER_WINDOW = 10; // frames to load immediately around current
const CONCURRENCY = 4;

export function ShaktiJourney() {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [loadPct, setLoadPct] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // ── image cache ───────────────────────────────────────────────────────
    const cache: (HTMLImageElement | null)[] = new Array(TOTAL_FRAMES).fill(null);
    let loadedCount = 0;
    let disposed = false;

    function loadOne(idx: number): Promise<void> {
      if (cache[idx] || idx < 0 || idx >= TOTAL_FRAMES) return Promise.resolve();
      return new Promise((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.src = SHAKTHI_FRAMES[idx]!;
        const done = () => {
          if (!disposed) {
            cache[idx] = img;
            loadedCount++;
            setLoadPct(Math.round((loadedCount / TOTAL_FRAMES) * 100));
            needsDraw = true;
          }
          resolve();
        };
        img.onload = () => (img.decode ? img.decode().then(done, done) : done());
        img.onerror = () => {
          if (import.meta.env.DEV) console.warn("[Shakthi] missing frame:", SHAKTHI_FRAMES[idx]);
          resolve();
        };
      });
    }

    // load with bounded concurrency
    async function loadRange(start: number, end: number) {
      const indices: number[] = [];
      for (let i = start; i <= end; i++) if (!cache[i]) indices.push(i);
      for (let i = 0; i < indices.length; i += CONCURRENCY) {
        if (disposed) break;
        await Promise.all(indices.slice(i, i + CONCURRENCY).map(loadOne));
      }
    }

    // ── canvas sizing ─────────────────────────────────────────────────────
    let W = 0, H = 0;
    let needsDraw = true;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needsDraw = true;
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    // ── draw ──────────────────────────────────────────────────────────────
    function nearest(idx: number): HTMLImageElement | null {
      for (let d = 0; d < TOTAL_FRAMES; d++) {
        if (cache[idx - d]) return cache[idx - d]!;
        if (cache[idx + d]) return cache[idx + d]!;
      }
      return null;
    }

    function draw(frameIdx: number) {
      const idx = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(frameIdx)));
      const img = cache[idx] ?? nearest(idx);
      if (!img) return;
      // cover-fit: preserve aspect ratio, fill viewport
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }

    // ── scroll state ──────────────────────────────────────────────────────
    let scrollProgress = 0; // 0..1 over the track
    let targetFrame = 0;
    let currentFrame = 0;
    let lastDrawnFrame = -1;
    let rafId = 0;

    function getScrollProgress(): number {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      const trackH = track.offsetHeight - window.innerHeight;
      if (trackH <= 0) return 0;
      return Math.max(0, Math.min(1, -rect.top / trackH));
    }

    function onScroll() {
      scrollProgress = getScrollProgress();
      targetFrame = scrollProgress * (TOTAL_FRAMES - 1);

      // eagerly load frames near current position
      const near = Math.round(targetFrame);
      const lo = Math.max(0, near - EAGER_WINDOW);
      const hi = Math.min(TOTAL_FRAMES - 1, near + EAGER_WINDOW);
      loadRange(lo, hi);
    }

    function tick() {
      rafId = requestAnimationFrame(tick);

      // lerp toward target (instant in reduced-motion)
      currentFrame += (targetFrame - currentFrame) * (reduce ? 1 : 0.14);
      if (Math.abs(targetFrame - currentFrame) < 0.05) currentFrame = targetFrame;

      const fi = Math.round(currentFrame);
      if (needsDraw || fi !== lastDrawnFrame) {
        draw(currentFrame);
        lastDrawnFrame = fi;
        needsDraw = false;
      }

      // overlay opacity
      const p = currentFrame / (TOTAL_FRAMES - 1); // 0..1
      overlayRefs.current.forEach((el, i) => {
        if (!el) return;
        const sec = OVERLAY_SECTIONS[i]!;
        const secStart = sec.startFrame / (TOTAL_FRAMES - 1);
        const secEnd = sec.endFrame / (TOTAL_FRAMES - 1);
        const len = secEnd - secStart;
        const fade = Math.max(len * 0.18, 0.015);
        let o = 0;
        if (p >= secStart && p <= secEnd) {
          o = Math.min(sm((p - secStart) / fade), sm((secEnd - p) / fade));
        }
        el.style.opacity = String(o);
        el.style.visibility = o < 0.005 ? "hidden" : "visible";
      });

      // progress bar
      if (progressFillRef.current) {
        progressFillRef.current.style.transform = `scaleX(${p})`;
      }
    }

    // ── boot sequence ─────────────────────────────────────────────────────
    (async () => {
      // load first frame before showing anything
      await loadOne(0);
      if (disposed) return;
      draw(0);
      setReady(true);

      // eager window around frame 0
      await loadRange(1, Math.min(TOTAL_FRAMES - 1, EAGER_WINDOW));
      if (disposed) return;

      // rest in background
      await loadRange(EAGER_WINDOW + 1, TOTAL_FRAMES - 1);
    })();

    window.addEventListener("scroll", onScroll, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="aikyam-page sk-page">
      <SiteNav />

      {/* ── loading screen ── */}
      {!ready && (
        <div className="sk-loader" aria-live="polite" aria-label="Loading Shakthi experience">
          <p className="aikyam-eyebrow">Shakthi — The Divine Feminine</p>
          <div className="sk-loader-rail">
            <div className="sk-loader-fill" style={{ transform: `scaleX(${loadPct / 100})` }} />
          </div>
          <span className="sk-loader-pct">{loadPct}%</span>
        </div>
      )}

      {/* ── cinematic scroll track ── */}
      <div
        ref={trackRef}
        className="sk-track"
        style={{ height: "500vh" }}
        aria-label="Shakthi cinematic scroll experience — 135 frames"
      >
        <div className="sk-stage" aria-hidden={!ready}>
          {/* canvas — primary rendering surface */}
          <canvas
            ref={canvasRef}
            className="sk-canvas"
            aria-hidden="true"
            style={{ opacity: ready ? 1 : 0 }}
          />

          {/* vignette */}
          <div className="sk-vignette" aria-hidden="true" />

          {/* editorial overlays — one per section */}
          {OVERLAY_SECTIONS.map((sec, i) => (
            <div
              key={i}
              ref={(el) => { overlayRefs.current[i] = el; }}
              className={`sk-overlay sk-overlay--${sec.position}`}
              style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? "visible" : "hidden" }}
              aria-hidden="true"
            >
              <div className="sk-overlay-scrim" />
              <div className="sk-overlay-body">
                <p className="sk-overlay-eyebrow">{sec.eyebrow}</p>
                <h2 className="sk-overlay-title">{sec.title}</h2>
                <p className="sk-overlay-sub">{sec.subtitle}</p>
                {i === 0 && (
                  <p className="sk-cue">Scroll to discover ↓</p>
                )}
              </div>
            </div>
          ))}

          {/* progress bar */}
          <div className="sk-progress" aria-hidden="true">
            <div ref={progressFillRef} className="sk-progress-fill" />
          </div>
        </div>

        {/* screen-reader accessible summary */}
        <div className="sr-only">
          <h1>Shakthi — The Divine Feminine</h1>
          <p>
            A cinematic scroll journey through 135 frames depicting the Sri Chakra and sacred
            expressions of Shakti. Scroll to advance through the sequence.
          </p>
        </div>
      </div>

      {/* ── 18 Maha Shakti Peethas section ── */}
      <section className="sk-peethas" aria-labelledby="sk-peethas-heading">
        <div className="sk-peethas-intro">
          <p className="aikyam-eyebrow">Sacred Geography</p>
          <h2 id="sk-peethas-heading">The 18 Maha Shakti Peethas</h2>
          <p className="sk-peethas-lead">
            Across the sacred geography of the Indian subcontinent, the Maha Shakti Peethas are
            revered as manifestations of the Divine Feminine. Each sacred site carries its own
            traditions, history, and devotional significance.
          </p>
          <p className="sk-peethas-note">
            The list below follows one commonly cited Ashtadasha Shakti Peetha tradition.
            Traditions, spellings, and locations vary across sources and require editorial
            verification before publication. The cinematic frames above are artistic depictions
            and do not represent specific temple idols or deities.
          </p>
        </div>

        <ol className="sk-peethas-grid" aria-label="18 Maha Shakti Peethas">
          {SHAKTI_PEETHAS.map((p) => (
            <li key={p.seq} className="sk-peetha-card">
              <span className="sk-peetha-num">{String(p.seq).padStart(2, "0")}</span>
              <h3 className="sk-peetha-name">{p.name}</h3>
              <p className="sk-peetha-loc">{p.location}</p>
              {p.note && <p className="sk-peetha-editorial">{p.note}</p>}
            </li>
          ))}
        </ol>
      </section>

      {/* ── closing ── */}
      <section className="sk-closing" aria-label="Continue your journey">
        <p className="aikyam-eyebrow">The Journey Continues</p>
        <h2 className="sk-closing-h">
          One sacred energy.<br />Eighteen expressions.
        </h2>
        <p>
          The Shakti Peethas mark places where the divine creative energy is honoured across the
          land — an invitation to reflect on the creative possibilities you carry within you.
        </p>
        <div className="aikyam-actions">
          <a href="/aikya-mandala">
            Return to AIKYA Mandala <span aria-hidden="true">↗</span>
          </a>
          <a href="/about">
            Back to About AIKYAM <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
