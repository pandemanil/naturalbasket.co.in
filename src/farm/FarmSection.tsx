import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { FarmView } from './types';

// three.js and react-three-fiber load only when this section is shown.
const FarmScene = lazy(() => import('./FarmScene'));

const VIEWS: { id: FarmView; label: string }[] = [
  { id: 'farm', label: 'Explore Farm' },
  { id: 'garden', label: 'Explore Vegetables' },
  { id: 'milk', label: 'Explore Fresh Milk' },
];

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isSmallScreen(): boolean {
  return window.matchMedia('(max-width: 720px)').matches;
}

// If the 3D scene throws at runtime, show the static poster instead of a blank page.
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function FarmPoster() {
  return (
    <div className="farm-poster">
      <figure>
        <img
          src="/images/farm-poster.webp"
          alt="Indian village farm at golden hour with vegetable fields, a wooden cow shed, Gir cows, calves and chickens"
          width={1600}
          height={900}
          loading="lazy"
          decoding="async"
        />
      </figure>
      <figure className="farm-poster-milk">
        <img
          src="/images/milk-poster.webp"
          alt="Fresh milk pouring into a glass with the Natural Basket logo"
          width={900}
          height={1350}
          loading="lazy"
          decoding="async"
        />
      </figure>
    </div>
  );
}

export default function FarmSection() {
  const [view, setView] = useState<FarmView>('farm');
  const [threeD, setThreeD] = useState(false);
  const [webgl] = useState(supportsWebGL);
  const [reduced] = useState(prefersReducedMotion);
  const [small] = useState(isSmallScreen);
  const video = useRef<HTMLVideoElement>(null);

  // Restart the clip when the view changes; keep the vegetables view on its first few seconds.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    try {
      v.currentTime = 0;
      if (!reduced) void v.play().catch(() => undefined);
    } catch {
      // autoplay can be blocked; the poster stays visible
    }
  }, [view, threeD, reduced]);

  // Save battery: pause the clip while it is off screen.
  useEffect(() => {
    const v = video.current;
    if (!v || reduced || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) void v.play().catch(() => undefined);
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, [threeD, view, reduced]);

  const onTime = () => {
    const v = video.current;
    if (v && view === 'garden' && v.currentTime > 4.5) v.currentTime = 0;
  };

  return (
    <section className="farm" aria-labelledby="farm-title">
      <div className="farm-head">
        <p className="eyebrow">Natural Basket · Farm tour</p>
        <h2 id="farm-title">Farming in Front of <em>Your Eyes</em></h2>
        <p className="muted">Nature's Goodness. Delivered.</p>
      </div>

      <div className="farm-stage">
        {threeD && webgl ? (
          <div className="farm-canvas-wrap" role="region" aria-label="Interactive 3D farm view">
            <SceneBoundary fallback={<FarmPoster />}>
              <Suspense
                fallback={
                  <div className="farm-loading" role="status">
                    <img src="/images/logo.webp" alt="" width={72} height={72} />
                    <span>Growing the farm…</span>
                  </div>
                }
              >
                <FarmScene view={view} reduced={reduced} mobile={small} />
              </Suspense>
            </SceneBoundary>
          </div>
        ) : view === 'milk' ? (
          <div className="farm-media farm-milk">
            <img src="/images/milk-poster.webp" alt="Fresh milk pouring into a glass with the Natural Basket logo" width={900} height={1350} decoding="async" />
            <span className="drop d1" aria-hidden="true" /><span className="drop d2" aria-hidden="true" /><span className="drop d3" aria-hidden="true" />
          </div>
        ) : (
          <div className={view === 'garden' ? 'farm-media zoom' : 'farm-media'}>
            <video
              ref={video}
              src="/video/farm.mp4"
              poster="/video/farm-poster.webp"
              muted
              loop
              playsInline
              autoPlay={!reduced}
              controls={reduced}
              preload="metadata"
              onTimeUpdate={onTime}
              aria-label="Video of the Natural Basket farm: vegetable rows, Gir cows in a shed and free-range hens"
            />
            <div className="farm-media-fade" aria-hidden="true" />
          </div>
        )}

        <div className="farm-controls" role="group" aria-label="Choose where to explore">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={view === v.id ? 'btn primary' : 'btn'}
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
          {view === 'garden' && <a className="btn" href="#shop">Shop vegetables</a>}
          {view === 'milk' && <a className="btn" href="#shop">Shop milk products</a>}
        </div>
        {webgl && (
          <p className="farm-hint muted">
            <button type="button" className="link-btn" onClick={() => setThreeD((t) => !t)} aria-pressed={threeD}>
              {threeD ? 'Back to the real farm video' : 'View as interactive 3D'}
            </button>
            {threeD && ' · Drag to look around, scroll or pinch to zoom'}
          </p>
        )}
        {!webgl && threeD && <FarmPoster />}
      </div>
    </section>
  );
}
