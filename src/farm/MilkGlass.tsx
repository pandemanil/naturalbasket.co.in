import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

type Props = { active: boolean; reduced: boolean; mobile: boolean };

const SPOUT_X = 1.2;
const SPOUT_Y = 4.3;
const LIQUID_TOP = 2.7;
const GLASS_TOP = 3.2;

const rand = (n: number) => {
  const x = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};

// Path of the poured milk: leaves the jug sideways, then arcs down under gravity.
const streamAt = (f: number) => ({
  x: SPOUT_X * (1 - f),
  y: SPOUT_Y - (SPOUT_Y - LIQUID_TOP) * f * f,
});

// Lightweight pour: a smooth milk stream, plus round droplets, ripples and sparkles.
// No fluid simulation, so it stays smooth on phones.
export default function MilkGlass({ active, reduced, mobile }: Props) {
  const logo = useTexture('/images/logo.webp');
  useLayoutEffect(() => {
    logo.colorSpace = THREE.SRGBColorSpace;
    logo.anisotropy = 4;
    logo.needsUpdate = true;
  }, [logo]);
  const counts = mobile
    ? { drops: 50, splash: 70, sparkle: 36 }
    : { drops: 110, splash: 150, sparkle: 80 };

  // Soft round sprite so particles are circles, not squares.
  const sprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(c);
  }, []);

  const data = useMemo(() => {
    const splashSeed = new Float32Array(counts.splash * 3);
    for (let i = 0; i < counts.splash; i++) {
      const a = rand(i) * Math.PI * 2;
      const r = 0.5 + rand(i + 0.5) * 0.7;
      splashSeed[i * 3] = Math.cos(a) * r;
      splashSeed[i * 3 + 1] = 1.4 + rand(i + 1.5) * 1.5;
      splashSeed[i * 3 + 2] = Math.sin(a) * r;
    }
    const sparkleBase = new Float32Array(counts.sparkle * 3);
    for (let i = 0; i < counts.sparkle; i++) {
      const a = rand(i + 3) * Math.PI * 2;
      const r = 1 + rand(i + 3.5) * 0.8;
      sparkleBase[i * 3] = Math.cos(a) * r;
      sparkleBase[i * 3 + 1] = 0.4 + rand(i + 4) * 2.8;
      sparkleBase[i * 3 + 2] = Math.sin(a) * r;
    }
    return {
      drops: new Float32Array(counts.drops * 3),
      splash: new Float32Array(counts.splash * 3),
      splashSeed,
      sparkle: sparkleBase.slice(),
      sparkleBase,
    };
  }, [counts.drops, counts.splash, counts.sparkle]);

  const dropsRef = useRef<THREE.BufferAttribute>(null);
  const splashRef = useRef<THREE.BufferAttribute>(null);
  const sparkleRef = useRef<THREE.BufferAttribute>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);

  const streamGeometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const p = streamAt(i / 12);
      pts.push(new THREE.Vector3(p.x, p.y, 0));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.045, 10, false);
  }, []);

  // Outer glass wall, thick base, and the milk that fills it.
  const glassGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, 0),
          new THREE.Vector2(0.55, 0),
          new THREE.Vector2(0.58, 0.05),
          new THREE.Vector2(0.66, 1.8),
          new THREE.Vector2(0.72, GLASS_TOP),
        ],
        56,
      ),
    [],
  );
  const innerGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.5, 0.14),
          new THREE.Vector2(0.54, 0.2),
          new THREE.Vector2(0.64, 1.8),
          new THREE.Vector2(0.7, GLASS_TOP),
        ],
        56,
      ),
    [],
  );
  const milkGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, 0.14),
          new THREE.Vector2(0.49, 0.14),
          new THREE.Vector2(0.53, 0.21),
          new THREE.Vector2(0.675, LIQUID_TOP),
          new THREE.Vector2(0.001, LIQUID_TOP),
        ],
        56,
      ),
    [],
  );

  // Blurred farm backdrop: a warm gradient with out-of-focus green lights.
  const backdrop = useMemo(() => {
    const g = new THREE.PlaneGeometry(44, 26, 1, 8);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color('#7FA34C');
    const mid = new THREE.Color('#D7DE9A');
    const high = new THREE.Color('#F6E7C1');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = THREE.MathUtils.clamp((pos.getY(i) + 13) / 26, 0, 1);
      if (h < 0.5) c.copy(low).lerp(mid, h / 0.5);
      else c.copy(mid).lerp(high, (h - 0.5) / 0.5);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const tones = ['#9CC45A', '#C9D86B', '#6FA043', '#F4E3A0'];
    const bokeh = Array.from({ length: 16 }, (_, i) => ({
      x: (rand(i + 40) - 0.5) * 20,
      y: rand(i + 41) * 8 - 0.5,
      r: 0.4 + rand(i + 42) * 0.9,
      color: tones[i % 4],
    }));
    return { geometry: g, bokeh };
  }, []);

  useFrame((state) => {
    if (!active || reduced) return;
    const t = state.clock.elapsedTime;

    // Fine droplets travelling along the stream, so the pour has life.
    const d = data.drops;
    for (let i = 0; i < counts.drops; i++) {
      const f = (t * 0.7 + i / counts.drops) % 1;
      const p = streamAt(f);
      d[i * 3] = p.x + Math.sin(i * 12.9 + t * 3) * 0.04;
      d[i * 3 + 1] = p.y;
      d[i * 3 + 2] = Math.cos(i * 7.3 + t * 2.5) * 0.04;
    }
    if (dropsRef.current) dropsRef.current.needsUpdate = true;

    // Splashes: droplets bounce outward from the impact point and fall back.
    const p = data.splash;
    const seed = data.splashSeed;
    for (let i = 0; i < counts.splash; i++) {
      const life = (t * 0.9 + i / counts.splash) % 1;
      p[i * 3] = seed[i * 3] * life;
      p[i * 3 + 1] = LIQUID_TOP + seed[i * 3 + 1] * life - 3.2 * life * life;
      p[i * 3 + 2] = seed[i * 3 + 2] * life;
    }
    if (splashRef.current) splashRef.current.needsUpdate = true;

    // Sparkles: slow upward drift that wraps around, so there is no jump.
    const sp = data.sparkle;
    const base = data.sparkleBase;
    for (let i = 0; i < counts.sparkle; i++) {
      sp[i * 3] = base[i * 3];
      sp[i * 3 + 1] = ((base[i * 3 + 1] + t * 0.12 + i * 0.03) % 3.2) + 0.2;
      sp[i * 3 + 2] = base[i * 3 + 2];
    }
    if (sparkleRef.current) sparkleRef.current.needsUpdate = true;

    // Two ripples spreading from where the stream lands.
    const ripples: [THREE.Mesh | null, number][] = [[ringA.current, (t * 0.9) % 1], [ringB.current, (t * 0.9 + 0.5) % 1]];
    ripples.forEach(([ring, k]) => {
      if (!ring) return;
      ring.scale.setScalar(0.25 + k * 0.9);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    });
  });

  return (
    <group>
      {/* Backdrop */}
      <mesh geometry={backdrop.geometry} position={[0, 3, -10]}>
        <meshBasicMaterial vertexColors fog={false} />
      </mesh>
      {backdrop.bokeh.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, -9.5]}>
          <circleGeometry args={[b.r, 24]} />
          <meshBasicMaterial color={b.color} transparent opacity={0.35} depthWrite={false} fog={false} />
        </mesh>
      ))}

      {/* Wooden table top and burlap mat */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <cylinderGeometry args={[2.6, 2.6, 0.24, 56]} />
        <meshStandardMaterial color="#8B5E34" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 40]} />
        <meshStandardMaterial color="#C9A96A" roughness={1} />
      </mesh>

      {/* Milk and its glossy surface */}
      <mesh geometry={milkGeometry} castShadow>
        <meshStandardMaterial color="#FFFFFF" emissive="#FFF6E6" emissiveIntensity={0.55} roughness={0.3} />
      </mesh>
      <mesh position={[0, LIQUID_TOP + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.64, 0.035, 8, 56]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      {[ringA, ringB].map((ref, i) => (
        <mesh key={i} ref={ref} position={[0, LIQUID_TOP + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.5, 0.012, 6, 48]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}

      {/* Glass: outer wall, inner wall, thick base, and fake highlights */}
      <mesh geometry={glassGeometry}>
        <meshPhysicalMaterial color="#FFFFFF" transparent opacity={0.16} roughness={0.03} clearcoat={1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={innerGeometry}>
        <meshPhysicalMaterial color="#EAF4EA" transparent opacity={0.1} roughness={0.03} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.14, 40]} />
        <meshPhysicalMaterial color="#F2FAF2" transparent opacity={0.4} roughness={0.05} clearcoat={1} depthWrite={false} />
      </mesh>
      <mesh position={[0, GLASS_TOP, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.02, 8, 56]} />
        <meshStandardMaterial color="#EAF4EA" transparent opacity={0.55} roughness={0.2} />
      </mesh>
      {[0.9, -1.1].map((start) => (
        <mesh key={start} position={[0, 1.7, 0]}>
          <cylinderGeometry args={[0.725, 0.615, 2.4, 8, 1, true, start, 0.2]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}

      {/* Natural Basket logo printed on the front of the glass */}
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.655, 0.655, 0.56, 36, 1, true, -0.62, 1.24]} />
        <meshStandardMaterial map={logo} roughness={0.45} />
      </mesh>

      {/* Milk jug */}
      <group position={[1.94, SPOUT_Y + 0.14, 0]} rotation={[0, 0, 0.95]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.5, 0.55, 1.1, 32]} />
          <meshStandardMaterial color="#F7F3EA" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.58, 0]}>
          <torusGeometry args={[0.5, 0.04, 8, 32]} />
          <meshStandardMaterial color="#F7F3EA" roughness={0.35} />
        </mesh>
        <mesh position={[-0.52, 0.52, 0]} rotation={[0, 0, 0.6]}>
          <coneGeometry args={[0.16, 0.3, 16]} />
          <meshStandardMaterial color="#F7F3EA" roughness={0.35} />
        </mesh>
        <mesh position={[0.62, 0, 0]}>
          <torusGeometry args={[0.28, 0.05, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#F7F3EA" roughness={0.35} />
        </mesh>
      </group>

      {/* Pouring stream */}
      <mesh geometry={streamGeometry}>
        <meshStandardMaterial color="#FFFFFF" emissive="#FFF6E6" emissiveIntensity={0.5} roughness={0.2} />
      </mesh>

      {/* Fine droplets along the stream */}
      <points visible={!reduced}>
        <bufferGeometry>
          <bufferAttribute ref={dropsRef} attach="attributes-position" args={[data.drops, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} color="#FFFFFF" size={0.07} sizeAttenuation transparent alphaTest={0.05} depthWrite={false} />
      </points>

      {/* Splash droplets */}
      <points visible={!reduced}>
        <bufferGeometry>
          <bufferAttribute ref={splashRef} attach="attributes-position" args={[data.splash, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} color="#FFFFFF" size={0.09} sizeAttenuation transparent alphaTest={0.05} depthWrite={false} />
      </points>

      {/* Sparkles */}
      <points>
        <bufferGeometry>
          <bufferAttribute ref={sparkleRef} attach="attributes-position" args={[data.sparkle, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} color="#FFF3B8" size={0.1} sizeAttenuation transparent alphaTest={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}
