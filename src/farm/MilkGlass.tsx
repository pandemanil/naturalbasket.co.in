import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

type Props = { active: boolean; reduced: boolean; mobile: boolean };

const SPOUT_Y = 4.2;
const LIQUID_TOP = 2.7;
const GLASS_TOP = 3.2;

const rand = (n: number) => {
  const x = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};

// Lightweight pour: point clouds for the stream, splashes and sparkles.
// No fluid simulation, so it stays smooth on phones.
export default function MilkGlass({ active, reduced, mobile }: Props) {
  const counts = mobile
    ? { stream: 160, splash: 70, sparkle: 36 }
    : { stream: 340, splash: 150, sparkle: 80 };

  const data = useMemo(() => {
    const splashSeed = new Float32Array(counts.splash * 3);
    for (let i = 0; i < counts.splash; i++) {
      const a = rand(i) * Math.PI * 2;
      const r = 0.6 + rand(i + 0.5) * 0.9;
      splashSeed[i * 3] = Math.cos(a) * r;
      splashSeed[i * 3 + 1] = 1.6 + rand(i + 1.5) * 1.6;
      splashSeed[i * 3 + 2] = Math.sin(a) * r;
    }
    const sparkleBase = new Float32Array(counts.sparkle * 3);
    for (let i = 0; i < counts.sparkle; i++) {
      const a = rand(i + 3) * Math.PI * 2;
      const r = 1 + rand(i + 3.5) * 0.7;
      sparkleBase[i * 3] = Math.cos(a) * r;
      sparkleBase[i * 3 + 1] = 0.4 + rand(i + 4) * 2.8;
      sparkleBase[i * 3 + 2] = Math.sin(a) * r;
    }
    return {
      stream: new Float32Array(counts.stream * 3),
      splash: new Float32Array(counts.splash * 3),
      splashSeed,
      sparkle: sparkleBase.slice(),
      sparkleBase,
    };
  }, [counts.stream, counts.splash, counts.sparkle]);

  const streamRef = useRef<THREE.BufferAttribute>(null);
  const splashRef = useRef<THREE.BufferAttribute>(null);
  const sparkleRef = useRef<THREE.BufferAttribute>(null);

  const glassGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, 0),
          new THREE.Vector2(0.56, 0),
          new THREE.Vector2(0.6, 0.08),
          new THREE.Vector2(0.68, 1.8),
          new THREE.Vector2(0.74, GLASS_TOP),
        ],
        48,
      ),
    [],
  );

  const milkGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.001, 0.1),
          new THREE.Vector2(0.52, 0.1),
          new THREE.Vector2(0.62, 0.3),
          new THREE.Vector2(0.66, LIQUID_TOP),
          new THREE.Vector2(0.001, LIQUID_TOP),
        ],
        48,
      ),
    [],
  );

  useFrame((state) => {
    if (!active || reduced) return;
    const t = state.clock.elapsedTime;

    // Stream: falls from the jug's spout onto the milk surface, looping.
    const s = data.stream;
    for (let i = 0; i < counts.stream; i++) {
      const f = (t * 0.55 + i / counts.stream) % 1;
      s[i * 3] = 1.1 * (1 - f) + Math.sin(i * 12.9) * 0.012;
      s[i * 3 + 1] = SPOUT_Y - (SPOUT_Y - LIQUID_TOP) * f * f;
      s[i * 3 + 2] = Math.cos(i * 7.3) * 0.012;
    }
    if (streamRef.current) streamRef.current.needsUpdate = true;

    // Splashes: droplets bounce outward from the impact point and fall back.
    const p = data.splash;
    const seed = data.splashSeed;
    for (let i = 0; i < counts.splash; i++) {
      const life = (t * 0.9 + i / counts.splash) % 1;
      const vx = seed[i * 3];
      const vy = seed[i * 3 + 1];
      const vz = seed[i * 3 + 2];
      p[i * 3] = vx * life;
      p[i * 3 + 1] = LIQUID_TOP + vy * life - 3.2 * life * life;
      p[i * 3 + 2] = vz * life;
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
  });

  return (
    <group>
      {/* Wooden table top */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <cylinderGeometry args={[2.6, 2.6, 0.24, 48]} />
        <meshStandardMaterial color="#8B5E34" roughness={0.8} />
      </mesh>

      {/* Glass */}
      <mesh geometry={glassGeometry}>
        <meshPhysicalMaterial
          color="#FFFFFF"
          transparent
          opacity={0.22}
          roughness={0.05}
          clearcoat={1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, GLASS_TOP, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.74, 0.02, 8, 48]} />
        <meshStandardMaterial color="#E8F4EA" transparent opacity={0.6} />
      </mesh>

      {/* Milk */}
      <mesh geometry={milkGeometry} castShadow>
        <meshStandardMaterial color="#FFFDF4" roughness={0.25} />
      </mesh>

      {/* Pouring stream */}
      <points visible={!reduced}>
        <bufferGeometry>
          <bufferAttribute ref={streamRef} attach="attributes-position" args={[data.stream, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#FFFFFF" size={0.09} sizeAttenuation transparent opacity={0.95} />
      </points>

      {/* Splash droplets */}
      <points visible={!reduced}>
        <bufferGeometry>
          <bufferAttribute ref={splashRef} attach="attributes-position" args={[data.splash, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#FFFFFF" size={0.06} sizeAttenuation transparent opacity={0.9} />
      </points>

      {/* Sparkles */}
      <points>
        <bufferGeometry>
          <bufferAttribute ref={sparkleRef} attach="attributes-position" args={[data.sparkle, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#FFF6C8" size={0.07} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
      </points>

      {/* Brand logo on the glass */}
      {/* Mounted only while this scene is active, so it never floats over the farm view */}
      {active && (
        <Html position={[0, 1.45, 0.66]} center transform distanceFactor={4.2} zIndexRange={[10, 0]}>
          <img src="/images/logo.webp" alt="Natural Basket logo" width={150} height={104} className="milk-logo" draggable={false} />
        </Html>
      )}
    </group>
  );
}
