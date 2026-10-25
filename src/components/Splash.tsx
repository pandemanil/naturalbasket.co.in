import { useEffect, useState } from 'react';

// A short branded intro, shown once per visit and skipped for reduced motion.
function shouldShow(): boolean {
  try {
    if (sessionStorage.getItem('nb_splash')) return false;
  } catch {
    // storage blocked: just show it
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Splash() {
  const [show, setShow] = useState(shouldShow);

  useEffect(() => {
    if (!show) return undefined;
    try {
      sessionStorage.setItem('nb_splash', '1');
    } catch {
      // ignore
    }
    const t = window.setTimeout(() => setShow(false), 1700);
    return () => window.clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div className="splash" aria-hidden="true">
      <svg className="splash-leaves" viewBox="0 0 120 100" width="120" height="100">
        <path className="leaf l1" d="M60 92 C30 70 22 38 40 14 C58 34 66 62 60 92Z" />
        <path className="leaf l2" d="M60 92 C90 70 98 38 80 14 C62 34 54 62 60 92Z" />
        <path className="leaf l3" d="M60 92 C46 64 48 36 60 8 C72 36 74 64 60 92Z" />
      </svg>
      <img src="/images/logo.webp" alt="" width={96} height={96} />
    </div>
  );
}
