import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Real 3D models, shrunk for the web (see scripts/optimize_glb.py).
export const COW_URL = '/models/cow.glb';
export const WHEAT_URL = '/models/wheat.glb';
export const GIR_URL = '/models/gir.glb';

// If a model fails to load, show the fallback instead of breaking the whole scene.
export class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Safe({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ModelBoundary>
  );
}

type CowModelProps = {
  url?: string;
  tint?: string;
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  phase: number;
  active: boolean;
  reduced: boolean;
};

// The photo-textured cow. The model faces +z; the group turns it to face +x like the rest of the farm.
export function CowModel({ url = COW_URL, tint, position, rotation = 0, scale = 1, phase, active, reduced }: CowModelProps) {
  const { scene } = useGLTF(url);
  const body = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (tint) {
          // Untextured Gir model: give each animal its own coat colour.
          const m = ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).clone();
          m.color.set(tint);
          (o as THREE.Mesh).material = m;
        }
      }
    });
    return c;
  }, [scene, tint]);

  useFrame((state) => {
    if (!active || reduced || !body.current) return;
    const t = state.clock.elapsedTime + phase;
    // Gentle breathing and a slow weight shift.
    body.current.scale.y = 1 + Math.sin(t * 1.6) * 0.008;
    body.current.rotation.z = Math.sin(t * 0.5) * 0.012;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <group rotation={[0, Math.PI / 2, 0]}>
        <group ref={body}>
          <primitive object={model} />
        </group>
      </group>
    </group>
  );
}

type WheatProps = { x0: number; x1: number; z0: number; z1: number; count: number; active: boolean; reduced: boolean };

const rand = (n: number) => {
  const x = Math.sin(n * 63.7 + 11.3) * 43758.5453;
  return x - Math.floor(x);
};

// A field of wheat: one instanced mesh, so hundreds of bunches cost a single draw call.
export function WheatField({ x0, x1, z0, z1, count, active, reduced }: WheatProps) {
  const { scene } = useGLTF(WHEAT_URL);
  const mesh = useMemo(() => {
    const holder: { mesh: THREE.Mesh | null } = { mesh: null };
    scene.traverse((o) => {
      if (!holder.mesh && (o as THREE.Mesh).isMesh) holder.mesh = o as THREE.Mesh;
    });
    return holder.mesh;
  }, [scene]);

  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: x0 + rand(i * 3.1) * (x1 - x0),
        z: z0 + rand(i * 5.3 + 1) * (z1 - z0),
        s: 0.9 + rand(i * 7.7) * 0.6,
        r: rand(i * 2.3) * Math.PI * 2,
        p: rand(i * 9.1) * 6,
      })),
    [count, x0, x1, z0, z1],
  );

  const place = (t: number) => {
    const m = ref.current;
    if (!m) return;
    items.forEach((it, i) => {
      dummy.position.set(it.x, 0, it.z);
      dummy.rotation.set(Math.sin(t * 1.3 + it.p) * 0.05, it.r, Math.sin(t * 1.1 + it.p * 1.7) * 0.06);
      dummy.scale.setScalar(it.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    place(0);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = ref.current;
    return () => {
      if (m) m.dispose();
    };
  }, []);
  useFrame((state) => {
    if (active && !reduced) place(state.clock.elapsedTime);
  });

  if (!mesh) return null;
  return <instancedMesh ref={ref} args={[mesh.geometry, mesh.material as THREE.Material, count]} frustumCulled={false} />;
}

// Start downloading the models as soon as the farm section loads.
useGLTF.preload(COW_URL);
useGLTF.preload(WHEAT_URL);
useGLTF.preload(GIR_URL);
