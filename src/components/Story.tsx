import { useEffect, useRef, useState } from 'react';

const STEPS = [
  { title: 'Grown naturally', text: 'Seeds go into the soil on local partner farms, tended the traditional way, without chemicals.' },
  { title: 'Picked and milked fresh', text: 'Vegetables are harvested and A2 desi cow milk is collected each morning, so it reaches you fresh.' },
  { title: 'Packed with care', text: 'Everything is sorted by hand and packed in clean baskets and bottles, with nothing added.' },
  { title: 'Delivered to your door', text: 'Your basket travels from the farm straight to your home, and we confirm every order on WhatsApp.' },
];

function Scene({ step }: { step: number }) {
  const on = (n: number) => (step === n ? 'scene-layer on' : 'scene-layer');
  return (
    <svg className={`story-scene s${step}`} viewBox="0 0 400 300" role="img" aria-label={`Step ${step + 1}: ${STEPS[step].title}`}>
      <defs>
        <linearGradient id="sg0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE3A3" /><stop offset="1" stopColor="#FFF4D2" /></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sg0)" />
      <circle className="sun" cx="320" cy="64" r="30" fill="#F5B83D" />
      <path d="M0 190 C80 160 160 175 240 160 C310 148 360 160 400 150 V300 H0Z" fill="#9CC96B" />
      <path d="M0 215 C90 195 180 210 260 198 C330 190 370 196 400 190 V300 H0Z" fill="#6FA843" />

      {/* 1: field rows with sprouts */}
      <g className={on(0)}>
        {[0, 1, 2].map((r) => (
          <g key={r}>
            <path d={`M-10 ${238 + r * 22} L410 ${230 + r * 22}`} stroke="#5B3A1E" strokeWidth="9" strokeLinecap="round" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <g key={i} transform={`translate(${30 + i * 48} ${232 + r * 22 - (i * 8) / 8})`}>
                <path d="M0 0 C-8 -12 -4 -22 0 -26 C4 -22 8 -12 0 0Z" fill="#2F7D32" />
                <path d="M0 0 C10 -6 14 -14 12 -20 C4 -16 0 -8 0 0Z" fill="#4CAF50" />
              </g>
            ))}
          </g>
        ))}
      </g>

      {/* 2: cow and milk pail */}
      <g className={on(1)}>
        <ellipse cx="170" cy="262" rx="70" ry="8" fill="#000" opacity=".12" />
        <rect x="108" y="196" width="108" height="56" rx="26" fill="#C98B55" />
        <ellipse cx="172" cy="206" rx="50" ry="12" fill="#D9A06A" />
        <rect x="124" y="238" width="10" height="28" rx="4" fill="#B6763F" />
        <rect x="196" y="238" width="10" height="28" rx="4" fill="#B6763F" />
        <rect x="204" y="214" width="42" height="26" rx="13" fill="#C98B55" />
        <path d="M240 214 L250 202 L256 214Z" fill="#8C5A2B" />
        <circle cx="232" cy="224" r="3" fill="#2B2118" />
        <path d="M108 214 C94 214 92 238 100 252" stroke="#8C5A2B" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M268 250 h46 l-6 -30 h-34z" fill="#E7E7E7" stroke="#9AA" strokeWidth="2" />
        <ellipse cx="291" cy="222" rx="17" ry="4" fill="#FFFDF4" />
      </g>

      {/* 3: packed crate */}
      <g className={on(2)}>
        <rect x="110" y="214" width="180" height="56" rx="6" fill="#B07A43" />
        <path d="M110 232 H290 M110 250 H290" stroke="#8C5A2B" strokeWidth="3" />
        <circle cx="150" cy="208" r="16" fill="#E53935" /><circle cx="184" cy="206" r="14" fill="#E53935" />
        <path d="M214 214 l12 -34 l12 34z" fill="#F28C28" /><path d="M238 214 l12 -30 l12 30z" fill="#F28C28" />
        <path d="M224 180 l-4 -10 M232 182 l0 -12 M240 184 l6 -10" stroke="#2F7D32" strokeWidth="4" strokeLinecap="round" />
        <rect x="258" y="176" width="20" height="40" rx="6" fill="#FFFDF4" stroke="#CFD8DC" strokeWidth="2" />
        <rect x="263" y="168" width="10" height="9" rx="2" fill="#38761D" />
      </g>

      {/* 4: delivery */}
      <g className={on(3)}>
        <path d="M0 262 H400" stroke="#6B7280" strokeWidth="26" />
        <path d="M0 262 H400" stroke="#FFF" strokeWidth="2" strokeDasharray="16 14" />
        <g className="van">
          <rect x="128" y="216" width="112" height="38" rx="8" fill="#38761D" />
          <path d="M240 226 h28 l14 14 v14 h-42z" fill="#2F6B18" />
          <rect x="248" y="231" width="16" height="11" rx="2" fill="#CDE9F5" />
          <circle cx="160" cy="256" r="11" fill="#1F2937" /><circle cx="262" cy="256" r="11" fill="#1F2937" />
          <circle cx="160" cy="256" r="4" fill="#9CA3AF" /><circle cx="262" cy="256" r="4" fill="#9CA3AF" />
          <path d="M152 230 q6 -14 14 0 q-6 6 -14 0z" fill="#8BC34A" />
        </g>
        <g transform="translate(300 150)">
          <rect x="0" y="40" width="64" height="48" fill="#F3E3C0" /><path d="M-8 42 L32 8 L72 42Z" fill="#B4532A" />
          <rect x="24" y="60" width="16" height="28" fill="#7A4A25" /><rect x="8" y="52" width="12" height="12" fill="#CDE9F5" />
        </g>
      </g>
    </svg>
  );
}

export default function Story() {
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="story" aria-labelledby="story-title">
      <div className="story-head">
        <p className="eyebrow">How it reaches you</p>
        <h2 id="story-title">From <em>farm</em> to your basket</h2>
      </div>
      <div className="story-grid">
        <div className="story-sticky">
          <Scene step={step} />
          <div className="story-progress" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s.title} className={i <= step ? 'dot on' : 'dot'} />
            ))}
          </div>
        </div>
        <ol className="story-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} data-step={i} ref={(el) => { refs.current[i] = el; }} className={i === step ? 'story-step active' : 'story-step'}>
              <span className="story-num">0{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
