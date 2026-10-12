import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import frameUrls from "@/assets/temple-frames.json";
import { chapters as chapterDefs, frameWeights, progressMarks as markDefs } from "./chapters";
import { MuteButton } from "@/components/ui/MuteButton";

const FRAMES = frameUrls as string[];
const INITIAL = 8;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

// Weighted scroll timeline: each frame-to-frame segment gets a share of scroll
// proportional to its weight, so the camera can linger at key moments.
const segW = Array.from({ length: FRAMES.length - 1 }, (_, i) => frameWeights[i + 1] ?? 1);
const total = segW.reduce((a, b) => a + b, 0);
const cum = [0];
segW.forEach((w) => cum.push(cum[cum.length - 1]! + w));
/** 1-based (fractional) frame number → scroll progress 0..1 */
const frameToProgress = (frame: number) => {
  const f = clamp(frame - 1, 0, FRAMES.length - 1);
  const i = Math.min(Math.floor(f), segW.length - 1);
  return (cum[i]! + segW[i]! * (f - i)) / total;
};
/** scroll progress → 0-based fractional frame index */
const progressToIndex = (p: number) => {
  const d = clamp(p) * total;
  let i = 0;
  while (i < segW.length - 1 && cum[i + 1]! <= d) i++;
  return i + (segW[i]! ? (d - cum[i]!) / segW[i]! : 0);
};

type Chapter = (typeof chapterDefs)[number] & { start: number; end: number };
const chapters: Chapter[] = chapterDefs.map((c) => ({
  ...c,
  start: c.startFrame <= 1 ? 0 : frameToProgress(c.startFrame),
  end: frameToProgress(c.endFrame),
}));
const progressMarks = markDefs.map((m) => ({ label: m.label, at: frameToProgress(m.frame) }));

function chapterState(c: Chapter, p: number) {
  const len = c.end - c.start;
  const fade = len * 0.28;
  const local = clamp((p - c.start) / len);
  let o: number;
  if (p < c.start || (!c.holdToEnd && p > c.end)) o = 0;
  else if (p < c.start + fade) o = smooth((p - c.start) / fade);
  else if (!c.holdToEnd && p > c.end - fade) o = smooth((c.end - p) / fade);
  else o = 1;
  if (c.id === "aerial" && p <= c.start + fade) o = 1; // visible on arrival
  const leaving = !c.holdToEnd && p > c.end - fade;
  return { o, local, leaving };
}

export function TempleExperience() {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);
  const fillRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const audio = audioRef.current!;
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  const toggleMute = () => {
    const audio = audioRef.current!;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const images: (HTMLImageElement | null)[] = new Array(FRAMES.length).fill(null);
    let count = 0;
    let disposed = false;

    const load = (i: number) =>
      new Promise<void>((res) => {
        const img = new Image();
        img.decoding = "async";
        img.src = FRAMES[i]!;
        const done = () => {
          if (disposed) return res();
          images[i] = img;
          count++;
          setLoaded(count);
          needsDraw = true;
          res();
        };
        img.onload = () => (img.decode ? img.decode().then(done, done) : done());
        img.onerror = () => res();
      });

    (async () => {
      await Promise.all(Array.from({ length: INITIAL }, (_, i) => load(i)));
      if (disposed) return;
      setReady(true);
      // Remaining frames: always fetch the unloaded frame nearest the camera first
      // (current scene → next scene → nearby → the rest), 4 at a time.
      const requested = new Set<number>(Array.from({ length: INITIAL }, (_, i) => i));
      const pick = () => {
        const here = Math.round(progressToIndex(target));
        for (let d = 0; d < FRAMES.length; d++) {
          for (const i of [here + d, here - d]) {
            if (i >= 0 && i < FRAMES.length && !requested.has(i)) { requested.add(i); return i; }
          }
        }
        return -1;
      };
      const worker = async () => {
        for (let i = pick(); i !== -1 && !disposed; i = pick()) await load(i);
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    })();

    // canvas sizing
    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      needsDraw = true;
    };

    const nearest = (i: number) => {
      for (let d = 0; d < FRAMES.length; d++) {
        if (images[i - d]) return images[i - d];
        if (images[i + d]) return images[i + d];
      }
      return null;
    };

    const drawImg = (img: HTMLImageElement, alpha: number) => {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    };

    let target = 0, current = 0, progress = 0, needsDraw = true, last = -1;
    const render = () => {
      current += (target - current) * (reduce ? 1 : 0.14);
      if (Math.abs(target - current) < 0.001) current = target;
      if (needsDraw || current !== last) {
        const f = progressToIndex(current);
        const a = Math.round(f);
        const A = images[a] ?? nearest(a);
        if (A) {
          ctx.globalAlpha = 1;
          drawImg(A, 1);
          ctx.globalAlpha = 1;
        }
        last = current;
        needsDraw = false;
      }
      // overlay text
      chapters.forEach((c, i) => {
        const el = chapterRefs.current[i];
        if (!el) return;
        const { o, local, leaving } = chapterState(c, progress);
        el.style.opacity = String(o);
        el.style.visibility = o < 0.001 ? "hidden" : "visible";
        const drift = reduce ? 0 : (0.5 - local) * 60;
        el.querySelectorAll<HTMLElement>("[data-depth]").forEach((n) => {
          const depth = parseFloat(n.dataset["depth"] ?? "0");
          const enter = (1 - o) * (leaving ? -20 : n.dataset["role"] === "title" ? 40 : 20);
          const x = n.dataset["role"] === "eyebrow" && !leaving ? -(1 - o) * 15 : 0;
          n.style.transform = `translate3d(${x}px, ${enter + drift * depth}px, 0)`;
          if (n.dataset["role"] === "title") {
            n.style.filter = `blur(${(1 - o) * 6}px)`;
            n.style.letterSpacing = `${0.02 + (1 - o) * 0.06}em`;
          }
          if (n.dataset["role"] === "line") n.style.transform = `scaleY(${clamp(local * 1.4)})`;
        });
      });
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${progress})`;
      markRefs.current.forEach((m, i) => {
        if (!m) return;
        const next = progressMarks[i + 1]?.at ?? 1.01;
        m.dataset["active"] = String(progress >= progressMarks[i]!.at && progress < next);
      });
      const hint = document.querySelector<HTMLElement>(".scroll-hint");
      if (hint) hint.style.visibility = progress > 0.02 ? "hidden" : "visible";
      canvas.style.transform = reduce ? "" : `scale(${1.05 - progress * 0.05})`;
    };

    resize();
    window.addEventListener("resize", resize);

    let lenis: Lenis | null = null;
    if (!reduce) {
      lenis = new Lenis({ duration: 1.4, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
    }
    const tick = (time: number) => {
      lenis?.raf(time * 1000);
      render();
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const st = ScrollTrigger.create({
      trigger: trackRef.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        progress = self.progress;
        target = self.progress;
      },
    });

    return () => {
      disposed = true;
      st.kill();
      gsap.ticker.remove(tick);
      lenis?.destroy();
      window.removeEventListener("resize", resize);
    };
  }, []);

  const pct = Math.round((loaded / FRAMES.length) * 100);

  return (
    <main>
      <div ref={trackRef} className="temple-track">
        <div className="temple-stage">
          <canvas ref={canvasRef} className="temple-canvas" aria-hidden />
          <div className="temple-vignette" aria-hidden />
          <div className="temple-grain" aria-hidden />

          {chapters.map((c, i) => (
            <section
              key={c.id}
              ref={(el) => { chapterRefs.current[i] = el; }}
              className="chapter"
              data-pos={c.position}
              data-size={c.size ?? "md"}
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              <div className="chapter-scrim" aria-hidden />
              {(c.position === "right" || c.position === "left") && (
                <span className="chapter-line" data-depth="0.4" data-role="line" />
              )}
              <div className="chapter-body">
                {c.eyebrow && (
                  <p className="chapter-eyebrow" data-depth="0.9" data-role="eyebrow">
                    {c.eyebrow}
                  </p>
                )}
                <h2 className="chapter-title" data-depth="0.6" data-role="title">
                  {c.title.map((l) => (
                    <span key={l} className="block">{l}</span>
                  ))}
                </h2>
                {c.description && (
                  <p className="chapter-desc" data-depth="0.8" data-role="desc">
                    {c.description}
                  </p>
                )}
                {c.holdToEnd && (
                  <a href="#top" className="chapter-cta" data-depth="1" data-role="desc">
                    Continue the journey ↓
                  </a>
                )}
              </div>
            </section>
          ))}

          <nav className="progress" aria-label="Journey progress">
            <div className="progress-rail">
              <div ref={fillRef} className="progress-fill" />
            </div>
            <div className="progress-marks">
              {progressMarks.map((m, i) => (
                <span key={m.label} ref={(el) => { markRefs.current[i] = el; }} style={{ top: `${m.at * 100}%` }}>
                  {m.label}
                </span>
              ))}
            </div>
          </nav>

          <div className="scroll-hint" aria-hidden>Scroll to enter</div>
          <MuteButton muted={muted} onClick={toggleMute} />

          <div className="loader" data-hidden={ready}>
            <p>Entering the Temple</p>
            <div className="loader-rail">
              <div className="loader-fill" style={{ transform: `scaleX(${Math.min(1, loaded / INITIAL)})` }} />
            </div>
            <span>{pct}%</span>
          </div>
        </div>
      </div>
      <audio ref={audioRef} src="/audios/om.mp4" loop autoPlay />
    </main>
  );
}
