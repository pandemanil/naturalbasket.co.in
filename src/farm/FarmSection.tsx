import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
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
  const [webgl] = useState(supportsWebGL);
  const [reduced] = useState(prefersReducedMotion);
  const [small] = useState(isSmallScreen);

  return (
    <section className="farm" aria-labelledby="farm-title">
      <div className="farm-head">
        <p className="eyebrow">Natural Basket · Farm tour</p>
        <h2 id="farm-title">Farming in Front of Your Eyes</h2>
        <p className="muted">Nature's Goodness. Delivered.</p>
      </div>

      {webgl ? (
        <div className="farm-stage">
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
          <p className="farm-hint muted">Drag to look around · Scroll or pinch to zoom</p>
          <p className="farm-credit muted small">
            3D models: <a href="https://sketchfab.com/3d-models/brown-cow-3d-model-14a5bf64cd93490682e841292b318d1b" target="_blank" rel="noopener noreferrer">Brown Cow</a> by iRahulRajput and{' '}
            <a href="https://sketchfab.com/3d-models/wheat-8d2edddda3104aab8108dffa1bbab6b2" target="_blank" rel="noopener noreferrer">Wheat</a> by KillTheSaint, via Sketchfab, licensed{' '}
            <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Resized for the web.
          </p>
        </div>
      ) : (
        <>
          <FarmPoster />
          <p className="muted">Your browser cannot show the 3D farm. Here is a picture of it instead.</p>
        </>
      )}
    </section>
  );
}
