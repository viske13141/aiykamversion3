import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sections, type AboutSection } from "./content";
import { JourneyLinks, SiteFooter, SiteNav } from "./SiteLayout";
import { MuteButton } from "@/components/ui/MuteButton";
import "./about.css";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const visuals = sections.flatMap((section, sectionIndex) =>
  section.images.map((src, index) => ({
    src,
    section: sectionIndex,
    fraction: index / section.images.length,
    focal:
      section.id === "shiva-shakti" && index === 0
        ? "100% 45%"
        : section.id === "everyday" || (section.id === "shiva-shakti" && index === 1)
          ? "60% 50%"
          : "50% 45%",
  })),
);

function Copy({ section, final = false }: { section: AboutSection; final?: boolean }) {
  const c = section.content;
  const items = ["Supporting item", "Goal", "Gate", "Practice"]
    .flatMap((group) =>
      Array.from({ length: 4 }, (_, i) => {
        const key = `${group} ${i + 1}`;
        return {
          title: c[`${key} title`],
          subtitle: c[`${key} subtitle`],
          text: c[`${key} text`] ?? c[`${key} description`],
        };
      }),
    )
    .filter((item) => item.title);
  return (
    <>
      <p className="aikyam-eyebrow">{c["Eyebrow"]}</p>
      {section.id === "hero" ? (
        <h1 id="about-hero">
          <span className="about-wordmark">AIKYAM</span>
          {c["Heading"]}
        </h1>
      ) : (
        <h2 id={final ? "about-next-actions" : `about-${section.id}`}>{c["Heading"]}</h2>
      )}
      <p className="about-description">{c["Introduction"]}</p>
      <div className="restored-body">
        {section.id !== "hero" && <p>{section.copy}</p>}
        {c["Body"] && <p>{c["Body"]}</p>}
        {c["Supporting line"] && <p>{c["Supporting line"]}</p>}
        {items.map((item) => {
          const isShakti = item.title === "Shakti — I CREATE";
          const inner = (
            <>
              <h3>{item.title}</h3>
              {item.subtitle && <p className="restored-subtitle">{item.subtitle}</p>}
              <p>{item.text}</p>
            </>
          );
          return isShakti ? (
            <a
              className="restored-item restored-item-link"
              key={item.title}
              href="/aikya-mandala/shakti"
              aria-label="Shakti — I CREATE: The 18 Maha Shakti Peethas. Explore the journey."
            >
              {inner}
              <span className="restored-item-cta" aria-hidden="true">Explore ↗</span>
            </a>
          ) : (
            <div className="restored-item" key={item.title}>
              {inner}
            </div>
          );
        })}
        {section.id === "shiva-shakti" && (
          <p className="restored-note">
            Stone and water are visual metaphors for stillness and movement.
          </p>
        )}
        {c["Reflection line"] && <p className="restored-closing">{c["Reflection line"]}</p>}
        {c["Closing line"] && <p className="restored-closing">{c["Closing line"]}</p>}
        {c["CTA destination"] && (
          <div className="aikyam-actions">
            <a href={c["CTA destination"]}>
              {c["CTA label"]} <span aria-hidden>↗</span>
            </a>
          </div>
        )}
        {final && <JourneyLinks />}
        {c["Supporting note"] && <p className="restored-note">{c["Supporting note"]}</p>}
        {section.id === "hero" && <p className="restored-scroll">{c["Scroll cue"]} ↓</p>}
      </div>
    </>
  );
}

export function AboutExperience() {
  const root = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);
  const [reading, setReading] = useState(false);

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
    if (reading) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add(
      "(prefers-reduced-motion: no-preference) and (min-width: 900px) and (min-height: 700px)",
      () => {
        const element = root.current!;
        const track = element.querySelector<HTMLElement>(".about-track")!;
        const chapters = Array.from(element.querySelectorAll<HTMLElement>(".restored-chapter"));
        const copies = chapters.map((chapter) =>
          chapter.querySelector<HTMLElement>(".about-copy")!,
        );
        const backdrops = chapters.map((chapter) =>
          chapter.querySelector<HTMLElement>(".restored-backdrop")!,
        );
        const images = Array.from(element.querySelectorAll<HTMLImageElement>(".about-visual"));
        const fill = element.querySelector<HTMLElement>(".about-progress-fill")!;
        const loaded = new Set<number>();
        const requested = new Set<number>();
        let disposed = false;
        let bounds: { start: number; height: number }[] = [];
        let distance = 1;
        const playhead = { progress: 0 };
        const measure = () => {
          copies.forEach((copy, i) => {
            // Long copy stays in natural document flow; short groups dwell in
            // the viewport, preserving the original quiet reading intervals.
            const available = window.innerHeight - 230;
            const tall = copy.offsetHeight > available;
            chapters[i]!.dataset["long"] = String(tall);
            chapters[i]!.style.minHeight =
              `${Math.max(window.innerHeight * 1.9, copy.offsetHeight + window.innerHeight * 0.95)}px`;
          });
          const top = track.getBoundingClientRect().top;
          bounds = chapters.map((chapter) => ({
            start: chapter.getBoundingClientRect().top - top,
            height: chapter.offsetHeight,
          }));
          distance = Math.max(1, track.offsetHeight - window.innerHeight);
        };
        const request = (index: number) => {
          if (index < 0 || index >= images.length || requested.has(index)) return;
          requested.add(index);
          const image = images[index]!;
          const done = async () => {
            try {
              await image.decode();
            } catch {
              /* naturalWidth still guards failed images. */
            }
            if (!disposed && image.naturalWidth) {
              loaded.add(index);
              render();
            }
          };
          image.onload = done;
          image.onerror = () => {
            if (!disposed && !image.dataset["fallback"]) {
              image.dataset["fallback"] = "true";
              image.src = visuals[index]!.src.replace(/\.webp$/, ".jpg");
            }
          };
          image.src = visuals[index]!.src;
          if (image.complete && image.naturalWidth) void done();
        };
        function render() {
          if (disposed || !bounds.length) return;
          const position = playhead.progress * distance;
          let activeSection = 0;
          bounds.forEach((bound, i) => {
            if (position >= bound.start) activeSection = i;
          });
          const bound = bounds[activeSection]!;
          const local = clamp((position - bound.start) / bound.height);
          let active = 0;
          visuals.forEach((v, i) => {
            if (v.section < activeSection || (v.section === activeSection && v.fraction <= local))
              active = i;
            if (Math.abs(v.section - activeSection) <= 1) request(i);
          });
          const v = visuals[active]!;
          const fade = smooth((local - v.fraction) / 0.13);
          const previous = [...loaded].filter((i) => i < active).sort((a, b) => b - a)[0];
          const fallback = previous ?? [...loaded][0];
          images.forEach((image, i) => {
            const visual = visuals[i]!;
            const b = bounds[visual.section]!;
            const p = clamp((position - b.start) / b.height);
            const drift = i % 2 === 0 ? p : 1 - p;
            image.style.objectPosition = visual.focal;
            image.style.transform = `translate3d(${(drift - 0.5) * 1.2}%, ${(p - 0.5) * 0.8}%, 0) scale(${1.025 + drift * 0.045})`;
            let opacity = i === fallback ? 1 : 0;
            if (i === active && loaded.has(i)) opacity = previous === undefined ? 1 : fade;
            image.style.opacity = String(opacity);
            image.style.willChange = opacity > 0 ? "transform, opacity" : "auto";
          });
          copies.forEach((copy, i) => {
            const b = bounds[i]!;
            const delta = position - b.start;
            const enter = i === 0 ? 1 : smooth(delta / (window.innerHeight * 0.18));
            // Fade only once the final paragraph has cleared the viewport.
            const leave =
              1 -
              smooth((delta - (b.height - window.innerHeight * 0.3)) / (window.innerHeight * 0.2));
            const opacity = delta < 0 ? 0 : enter * leave;
            copy.style.opacity = String(opacity);
            copy.style.transform = `translateY(${(1 - enter) * 16}px)`;
            backdrops[i]!.style.opacity = String(opacity);
          });
          fill.style.transform = `scaleX(${playhead.progress})`;
        }
        element.classList.add("about-restored-motion");
        measure();
        const tween = gsap.to(playhead, {
          progress: 1,
          ease: "none",
          onUpdate: render,
          scrollTrigger: {
            trigger: track,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.35,
            onRefresh: (trigger) => {
              measure();
              playhead.progress = trigger.progress;
              render();
            },
          },
        });
        const observer = new ResizeObserver(() => tween.scrollTrigger?.refresh());
        copies.forEach((copy) => observer.observe(copy));
        void document.fonts.ready.then(() => {
          if (!disposed) tween.scrollTrigger?.refresh();
        });
        render();
        return () => {
          disposed = true;
          observer.disconnect();
          tween.scrollTrigger?.kill();
          tween.kill();
          element.classList.remove("about-restored-motion");
          images.forEach((image) => {
            image.onload = null;
            image.onerror = null;
            image.removeAttribute("style");
          });
          [...copies, ...backdrops, ...chapters].forEach((el) => el.removeAttribute("style"));
        };
      },
    );
    return () => media.revert();
  }, [reading]);

  return (
    <div ref={root} className="aikyam-page about-page about-restored">
      <SiteNav>
        <a
          className="about-skip"
          href="#continue-journey"
          onClick={() =>
            document.getElementById("continue-journey")?.focus({ preventScroll: true })
          }
        >
          Skip introduction ↓
        </a>
      </SiteNav>
      <main>
        <div className="about-track">
          <div className="restored-stage-track">
            <div className="about-stage" aria-hidden="true">
              <div className="about-visuals">
                {visuals.map((v, i) => (
                  <img
                    className="about-visual"
                    key={v.src}
                    src={i === 0 ? v.src : undefined}
                    alt=""
                    decoding="async"
                    fetchPriority={i === 0 ? "high" : "auto"}
                  />
                ))}
              </div>
              <div className="about-progress">
                <div className="about-progress-fill" />
              </div>
            </div>
          </div>
          {sections.map((section, i) => (
            <section
              className="restored-chapter"
              key={section.id}
              data-side={i > 0 && i % 2 === 0 && i < 8 ? "right" : "left"}
              aria-labelledby={`about-${section.id}`}
            >
              <div className="restored-static" aria-hidden="true">
                <img src={section.images[0]} alt="" loading={i === 0 ? "eager" : "lazy"} />
              </div>
              <div className="restored-backdrop" aria-hidden="true" />
              <div className="about-copy">
                {i === 8 ? (
                  <>
                    <p className="aikyam-eyebrow">Your next step</p>
                    <h2 id="about-next">Continue Your Journey</h2>
                    <p className="about-description">{section.copy}</p>
                  </>
                ) : (
                  <Copy section={section} />
                )}
              </div>
            </section>
          ))}
        </div>
        <section
          className="about-outro"
          id="continue-journey"
          tabIndex={-1}
          aria-label="Continue your journey"
        >
          <div className="about-copy">
            <Copy section={sections[8]!} final />
          </div>
        </section>
      </main>
      {!reading && (
        <div className="restored-controls">
          <span>About AIKYAM</span>
          <button
            onClick={() => {
              setReading(true);
              window.scrollTo(0, 0);
            }}
          >
            Read without animation
          </button>
          <span>Scroll to explore ↓</span>
        </div>
      )}
      <audio ref={audioRef} src="/audios/about.mp4" loop autoPlay />
      <MuteButton muted={muted} onClick={toggleMute} />
      <SiteFooter />
    </div>
  );
}
