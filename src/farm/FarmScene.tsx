import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';
import * as THREE from 'three';
import Farm from './Farm';
import MilkGlass from './MilkGlass';
import type { FarmView } from './types';

type Props = { view: FarmView; reduced: boolean; mobile: boolean };

type Pose = { pos: [number, number, number]; target: [number, number, number] };

export const VIEW_POSES: Record<FarmView, Pose> = {
  farm: { pos: [3, 8.5, 22], target: [2, 1.2, 2] },
  garden: { pos: [-3, 4.5, 10], target: [-10, 0.6, 0] },
  milk: { pos: [0, 2.6, 7], target: [0, 1.9, 0] },
};

// The subset of OrbitControls we use, so we avoid importing three-stdlib types directly.
type OrbitLike = { target: THREE.Vector3; update: () => void };

// Smoothly moves the camera between the three scenes with GSAP.
function CameraRig({ view, reduced }: { view: FarmView; reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as OrbitLike | null;
  const state = useRef({ px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 });
  const started = useRef(false);

  useEffect(() => {
    const pose = VIEW_POSES[view];
    const to = {
      px: pose.pos[0], py: pose.pos[1], pz: pose.pos[2],
      tx: pose.target[0], ty: pose.target[1], tz: pose.target[2],
    };
    const apply = () => {
      const s = state.current;
      camera.position.set(s.px, s.py, s.pz);
      if (controls) {
        controls.target.set(s.tx, s.ty, s.tz);
        controls.update();
      } else {
        camera.lookAt(s.tx, s.ty, s.tz);
      }
    };

    let tween: gsap.core.Tween | undefined;
    if (!started.current || reduced) {
      started.current = true;
      Object.assign(state.current, to);
      apply();
    } else {
      tween = gsap.to(state.current, { ...to, duration: 1.8, ease: 'power2.inOut', onUpdate: apply });
    }
    return () => {
      tween?.kill();
    };
  }, [view, reduced, camera, controls]);

  return null;
}

export default function FarmScene({ view, reduced, mobile }: Props) {
  const farmActive = view !== 'milk';
  const milkActive = view === 'milk';

  return (
    <Canvas
      className="farm-canvas"
      shadows={!mobile}
      dpr={mobile ? [1, 1.5] : [1, 1.75]}
      camera={{ position: VIEW_POSES.farm.pos, fov: 42, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <fog attach="fog" args={['#F4DDB0', 70, 200]} />
      <hemisphereLight args={['#FFF3DA', '#6C8F3E', 0.9]} />
      <directionalLight
        position={[-18, 24, 12]}
        intensity={1.7}
        color="#FFD7A0"
        castShadow={!mobile}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-far={90}
      />

      <CameraRig view={view} reduced={reduced} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={3}
        maxDistance={48}
        maxPolarAngle={Math.PI * 0.47}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
      />

      <group visible={farmActive}>
        <Farm active={farmActive} reduced={reduced} mobile={mobile} />
      </group>
      <group visible={milkActive}>
        <MilkGlass active={milkActive} reduced={reduced} mobile={mobile} />
      </group>
    </Canvas>
  );
}
