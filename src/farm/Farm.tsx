import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CowModel, GIR_URL, Safe, WheatField } from './Models';

type Props = { active: boolean; reduced: boolean; mobile: boolean };

// Deterministic pseudo-random, so the farm looks the same on every visit.
const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const ROW_X = [-15, -12.6, -10.2, -7.8, -5.4];
const PLANT_Z = Array.from({ length: 13 }, (_, i) => -7.2 + i * 1.2);

const PALMS: { kind: 'banana' | 'coconut'; position: [number, number, number] }[] = [
  { kind: 'coconut', position: [-21, 0, -12] },
  { kind: 'banana', position: [-19, 0, 9] },
  { kind: 'coconut', position: [19, 0, -12] },
  { kind: 'banana', position: [23, 0, 3] },
  { kind: 'coconut', position: [-24, 0, -22] },
  { kind: 'banana', position: [4, 0, -11] },
];

// ---------- Shared helpers ----------

type Item = {
  x: number; y: number; z: number;
  s: number; sy?: number;
  r?: number; rx?: number; rz?: number;
  color?: string;
};

// One InstancedMesh draws every item of a kind in a single GPU call.
function Instanced({ items, children, shadows = true }: { items: Item[]; children: ReactNode; shadows?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.scale.set(it.s, it.sy ?? it.s, it.s);
      dummy.rotation.set(it.rx ?? 0, it.r ?? 0, it.rz ?? 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (it.color) mesh.setColorAt(i, color.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={shadows} receiveShadow={shadows}>
      {children}
    </instancedMesh>
  );
}

// A soft dark disc under animals. Cheap contact shadow that also works on phones.
function Blob({ length = 1, width = 1, y = 0.03, opacity = 0.22 }: { length?: number; width?: number; y?: number; opacity?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} scale={[length, width, 1]}>
      <circleGeometry args={[1, 24]} />
      <meshBasicMaterial color="#000000" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// ---------- Vegetable garden ----------

function Garden() {
  const data = useMemo(() => {
    const leafy: Item[] = [];
    const foliage: Item[] = [];
    const stakes: Item[] = [];
    const fruit: Item[] = [];
    const carrots: Item[] = [];
    const carrotTops: Item[] = [];
    const greens = ['#4CA64C', '#3F8F3F', '#5BB35B'];
    const tomatoes = ['#D7261E', '#E24B2A', '#C81E1E', '#9BBF3E'];

    ROW_X.forEach((x, r) => {
      PLANT_Z.forEach((z, c) => {
        const k = r * 100 + c;
        const px = x + (rand(k) - 0.5) * 0.3;
        const pz = z + (rand(k + 0.5) - 0.5) * 0.3;
        const kind = r === 0 || r === 3 ? 'tomato' : r === 2 ? 'carrot' : 'leafy';

        if (kind === 'tomato') {
          foliage.push({ x: px, y: 0.55, z: pz, s: 0.46 + rand(k) * 0.12, sy: 0.8, color: '#3E8E3E' });
          foliage.push({ x: px + 0.15, y: 0.85, z: pz - 0.1, s: 0.34, sy: 0.7, color: '#4AA04A' });
          stakes.push({ x: px, y: 0.8, z: pz, s: 1 });
          for (let j = 0; j < 4; j++) {
            fruit.push({
              x: px + Math.cos(j * 1.7 + k) * 0.28,
              y: 0.4 + rand(k + j) * 0.5,
              z: pz + Math.sin(j * 1.7 + k) * 0.28,
              s: 1.15,
              color: tomatoes[(k + j) % 4],
            });
          }
        } else if (kind === 'carrot') {
          // Wide shoulder up, tip buried, with a feathery green top.
          carrots.push({ x: px, y: 0.2, z: pz, s: 1, rz: Math.PI, color: '#E8731E' });
          for (let j = 0; j < 3; j++) {
            carrotTops.push({
              x: px + Math.cos(j * 2.1) * 0.05,
              y: 0.55,
              z: pz + Math.sin(j * 2.1) * 0.05,
              s: 1,
              rx: Math.sin(j * 2.1) * 0.35,
              rz: Math.cos(j * 2.1) * 0.35,
              color: '#3C8D3C',
            });
          }
        } else {
          for (let j = 0; j < 3; j++) {
            leafy.push({
              x: px + Math.cos(j * 2.1) * 0.14,
              y: 0.22 + j * 0.03,
              z: pz + Math.sin(j * 2.1) * 0.14,
              s: 0.3 + rand(k + j) * 0.12,
              sy: 0.55,
              color: r === 4 ? (j % 2 ? '#2F7D32' : '#3A8A3A') : greens[(k + j) % 3],
            });
          }
        }
      });
    });

    // Bamboo fence posts along two edges of the garden.
    const posts: Item[] = [];
    for (let i = 0; i <= 9; i++) posts.push({ x: -16.4, y: 0.5, z: -8.8 + i * 2, s: 1 });
    for (let i = 1; i <= 5; i++) posts.push({ x: -16.4 + i * 2.5, y: 0.5, z: 8.9, s: 1 });

    return { leafy, foliage, stakes, fruit, carrots, carrotTops, posts };
  }, []);

  return (
    <group>
      {ROW_X.map((x) => (
        <group key={x}>
          <mesh position={[x, 0.06, 0]} receiveShadow>
            <boxGeometry args={[1.5, 0.12, 16.4]} />
            <meshStandardMaterial color="#5B3A22" roughness={1} />
          </mesh>
          {/* Drip irrigation line along each bed */}
          <mesh position={[x + 0.62, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 16.4, 6]} />
            <meshStandardMaterial color="#2F6F9F" roughness={0.5} />
          </mesh>
        </group>
      ))}

      <Instanced items={data.leafy}>
        <sphereGeometry args={[0.42, 10, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </Instanced>
      <Instanced items={data.foliage}>
        <sphereGeometry args={[0.4, 10, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </Instanced>
      <Instanced items={data.stakes}>
        <cylinderGeometry args={[0.03, 0.03, 1.5, 5]} />
        <meshStandardMaterial color="#C9A96A" roughness={0.9} />
      </Instanced>
      <Instanced items={data.fruit}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial roughness={0.35} />
      </Instanced>
      <Instanced items={data.carrots}>
        <coneGeometry args={[0.1, 0.45, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </Instanced>
      <Instanced items={data.carrotTops}>
        <coneGeometry args={[0.035, 0.4, 5]} />
        <meshStandardMaterial roughness={0.9} />
      </Instanced>
      <Instanced items={data.posts}>
        <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
        <meshStandardMaterial color="#A98A52" roughness={0.9} />
      </Instanced>

      <mesh position={[-10.3, 0.7, 8.9]}>
        <boxGeometry args={[12.5, 0.06, 0.06]} />
        <meshStandardMaterial color="#B89A5E" roughness={0.9} />
      </mesh>
      <mesh position={[-16.4, 0.7, 0]}>
        <boxGeometry args={[0.06, 0.06, 18.5]} />
        <meshStandardMaterial color="#B89A5E" roughness={0.9} />
      </mesh>
    </group>
  );
}

// Grass tufts scattered over the meadow, kept off the beds, path and shed.
function Flowers({ count }: { count: number }) {
  const items = useMemo(() => {
    const out: Item[] = [];
    const tones = ['#F6D743', '#FFFFFF', '#F28BB0', '#F6A33A'];
    for (let i = 0; i < count; i++) {
      const x = -16 + rand(i * 4.3 + 1) * 34;
      const z = 3.5 + rand(i * 6.1 + 2) * 13;
      if (Math.abs(x + 1) < 1.6) continue;
      out.push({
        x, y: 0.28, z,
        s: 0.8 + rand(i * 2.9) * 0.6,
        sy: 1,
        rx: 0, rz: 0, r: 0,
        color: tones[i % 4],
      });
    }
    return out;
  }, [count]);

  return (
    <Instanced items={items} shadows={false}>
      <sphereGeometry args={[0.06, 8, 6]} />
      <meshStandardMaterial roughness={0.8} />
    </Instanced>
  );
}

function Grass({ count }: { count: number }) {
  const items = useMemo(() => {
    const out: Item[] = [];
    const tones = ['#6FA043', '#7DB04C', '#5E8F3A', '#8DB855'];
    let i = 0;
    while (out.length < count && i < count * 6) {
      i++;
      const a = rand(i * 3.1) * Math.PI * 2;
      const d = 4 + rand(i * 5.7) * 32;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d * 0.8;
      const inGarden = x > -17.5 && x < -3.8 && Math.abs(z) < 9.6;
      const onPath = Math.abs(x + 1) < 1.5;
      const inShed = x > 5.5 && x < 14.5 && Math.abs(z) < 3;
      if (inGarden || onPath || inShed) continue;
      out.push({
        x, y: 0.2, z,
        s: 0.7 + rand(i * 9.3) * 0.7,
        sy: 0.6 + rand(i * 2.3) * 0.9,
        rx: (rand(i * 8.1) - 0.5) * 0.4,
        rz: (rand(i * 1.9) - 0.5) * 0.4,
        r: rand(i) * 6,
        color: tones[i % 4],
      });
    }
    return out;
  }, [count]);

  return (
    <Instanced items={items} shadows={false}>
      <coneGeometry args={[0.07, 0.45, 4]} />
      <meshStandardMaterial roughness={1} />
    </Instanced>
  );
}

// ---------- Animated animals ----------

type CowProps = {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  body?: string;
  patch?: string;
  spots?: boolean;
  phase: number;
  active: boolean;
  reduced: boolean;
};

// Gir-style cow: shoulder hump, bulging forehead, long drooping ears, dewlap.
// variant 'gir' is the humped, untextured Gir model tinted with the cow's body colour.
type RealCowProps = CowProps & { variant?: 'brown' | 'gir' };

function RealCow({ variant = 'brown', ...props }: RealCowProps) {
  const { position, rotation, scale, phase, active, reduced, body } = props;
  return (
    <Safe fallback={<Cow {...props} />}>
      {variant === 'gir' ? (
        <CowModel url={GIR_URL} tint={body} position={position} rotation={rotation} scale={scale} phase={phase} active={active} reduced={reduced} />
      ) : (
        <CowModel position={position} rotation={rotation} scale={scale} phase={phase} active={active} reduced={reduced} />
      )}
    </Safe>
  );
}

function Cow({ position, rotation = 0, scale = 1, body = '#B9825A', patch = '#F3EEE2', spots = false, phase, active, reduced }: CowProps) {
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const earL = useRef<THREE.Mesh>(null);
  const earR = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!active || reduced) return;
    const t = state.clock.elapsedTime;
    if (head.current) head.current.rotation.z = -0.3 + Math.sin(t * 0.7 + phase) * 0.08;
    if (tail.current) tail.current.rotation.z = Math.sin(t * 2.2 + phase) * 0.35;
    // Occasional ear flick.
    const flick = Math.max(0, Math.sin(t * 0.9 + phase * 2)) ** 8 * 0.35;
    if (earL.current) earL.current.rotation.x = -0.6 - flick;
    if (earR.current) earR.current.rotation.x = 0.6 + flick;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <Blob length={1.25} width={0.55} />

      {/* Barrel */}
      <mesh position={[0, 0.98, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.36, 0.95, 6, 14]} />
        <meshStandardMaterial color={body} roughness={0.85} />
      </mesh>
      {/* Shoulder hump */}
      <mesh position={[0.5, 1.4, 0]} scale={[0.9, 1, 0.8]} castShadow>
        <sphereGeometry args={[0.26, 12, 10]} />
        <meshStandardMaterial color={body} roughness={0.85} />
      </mesh>
      {/* Dewlap */}
      <mesh position={[0.72, 0.72, 0]} scale={[1.2, 0.9, 0.5]}>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial color={body} roughness={0.9} />
      </mesh>
      {spots &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[0.15, 1.05, side * 0.32]} scale={[0.55, 0.32, 0.12]}>
            <sphereGeometry args={[0.5, 12, 8]} />
            <meshStandardMaterial color={patch} roughness={0.9} />
          </mesh>
        ))}
      {/* Udder */}
      <mesh position={[-0.35, 0.58, 0]} scale={[0.9, 0.6, 0.9]}>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshStandardMaterial color="#E7A9A0" roughness={0.8} />
      </mesh>

      {/* Legs with hooves */}
      {[-0.6, 0.6].flatMap((x) =>
        [-0.22, 0.22].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 0.4, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.5, 4, 8]} />
              <meshStandardMaterial color={body} roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <cylinderGeometry args={[0.085, 0.09, 0.08, 8]} />
              <meshStandardMaterial color="#2B2118" roughness={0.6} />
            </mesh>
          </group>
        )),
      )}

      {/* Head pivots at the neck so it can graze gently */}
      <group ref={head} position={[0.95, 1.3, 0]}>
        <mesh position={[0.1, -0.05, 0]} scale={[1.4, 1, 0.9]} castShadow>
          <sphereGeometry args={[0.2, 10, 8]} />
          <meshStandardMaterial color={body} roughness={0.85} />
        </mesh>
        <mesh position={[0.3, -0.1, 0]} scale={[1.25, 1, 0.95]} castShadow>
          <sphereGeometry args={[0.22, 12, 10]} />
          <meshStandardMaterial color={body} roughness={0.85} />
        </mesh>
        {/* Bulging forehead */}
        <mesh position={[0.2, 0.08, 0]} scale={[1.1, 1, 1.2]}>
          <sphereGeometry args={[0.17, 10, 8]} />
          <meshStandardMaterial color={body} roughness={0.85} />
        </mesh>
        {/* Muzzle and nostrils */}
        <mesh position={[0.55, -0.2, 0]} scale={[1.2, 0.9, 1]}>
          <sphereGeometry args={[0.13, 10, 8]} />
          <meshStandardMaterial color="#CFA096" roughness={0.7} />
        </mesh>
        {[-0.05, 0.05].map((z) => (
          <mesh key={z} position={[0.66, -0.18, z]}>
            <sphereGeometry args={[0.02, 6, 5]} />
            <meshStandardMaterial color="#2B2118" />
          </mesh>
        ))}
        {/* Eyes */}
        {[-0.19, 0.19].map((z) => (
          <mesh key={z} position={[0.38, -0.02, z]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color="#1A1410" roughness={0.3} />
          </mesh>
        ))}
        {/* Horns */}
        {[-0.15, 0.15].map((z) => (
          <mesh key={z} position={[0.02, 0.27, z]} rotation={[0, 0, 0.5]}>
            <coneGeometry args={[0.04, 0.22, 6]} />
            <meshStandardMaterial color="#EFE7D2" roughness={0.5} />
          </mesh>
        ))}
        {/* Long drooping ears */}
        <mesh ref={earL} position={[0.1, -0.05, -0.28]} rotation={[-0.6, 0, 0]} scale={[0.7, 0.35, 1.5]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color={body} roughness={0.9} />
        </mesh>
        <mesh ref={earR} position={[0.1, -0.05, 0.28]} rotation={[0.6, 0, 0]} scale={[0.7, 0.35, 1.5]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color={body} roughness={0.9} />
        </mesh>
      </group>

      {/* Tail pivots at the rump */}
      <group ref={tail} position={[-0.85, 1.2, 0]}>
        <mesh position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.025, 0.02, 0.8, 5]} />
          <meshStandardMaterial color={body} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.85, 0]} scale={[1, 2, 1]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshStandardMaterial color="#3A2A1E" roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

type HenProps = { index: number; cx: number; cz: number; radius: number; color: string; big?: boolean; active: boolean; reduced: boolean };

function Chicken({ index, cx, cz, radius, color, big = false, active, reduced }: HenProps) {
  const ref = useRef<THREE.Group>(null);
  const scale = big ? 1.25 : 1;
  const wing = big ? '#1F1F1F' : color;

  useFrame((state) => {
    if (!ref.current || !active) return;
    const time = state.clock.elapsedTime;
    const t = reduced ? index * 1.7 : time * 0.25 + index * 1.7;
    ref.current.position.set(
      cx + Math.cos(t) * radius,
      reduced ? 0 : Math.abs(Math.sin(time * 9 + index)) * 0.05,
      cz + Math.sin(t) * radius,
    );
    // Face the direction of travel (the model's beak points along +x).
    ref.current.rotation.y = reduced ? 0 : Math.atan2(-Math.cos(t), -Math.sin(t));
  });

  return (
    <group ref={ref} scale={scale}>
      <mesh position={[0, 0.24, 0]} scale={[1.25, 0.95, 0.95]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      <mesh position={[0.12, 0.22, 0]}>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {[-0.16, 0.16].map((z) => (
        <mesh key={z} position={[-0.02, 0.27, z]} scale={[1, 0.6, 0.35]}>
          <sphereGeometry args={[0.14, 8, 6]} />
          <meshStandardMaterial color={wing} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0.2, 0.38, 0]} scale={[0.6, 1.2, 0.6]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      <mesh position={[0.26, 0.5, 0]}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      <mesh position={[0.34, 0.49, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.03, 0.08, 6]} />
        <meshStandardMaterial color="#E0A030" />
      </mesh>
      <mesh position={[0.25, 0.58, 0]} scale={[1.4, 0.9, 0.3]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshStandardMaterial color="#C81E1E" />
      </mesh>
      <mesh position={[0.3, 0.44, 0]}>
        <sphereGeometry args={[0.025, 6, 5]} />
        <meshStandardMaterial color="#C81E1E" />
      </mesh>
      {[-0.06, 0.06].map((z) => (
        <mesh key={z} position={[0.29, 0.52, z]}>
          <sphereGeometry args={[0.014, 6, 5]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {/* Tail fan */}
      {[-0.3, 0, 0.3].map((a) => (
        <mesh key={a} position={[-0.26, 0.36, a * 0.25]} rotation={[a, 0, Math.PI / 4 + a * 0.2]}>
          <coneGeometry args={[0.05, big ? 0.38 : 0.26, 6]} />
          <meshStandardMaterial color={big ? '#1F3A2A' : color} roughness={0.9} />
        </mesh>
      ))}
      {/* Legs */}
      {[-0.05, 0.05].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.012, 0.014, 0.14, 5]} />
            <meshStandardMaterial color="#D08B3A" />
          </mesh>
          <mesh position={[0.025, 0.01, 0]}>
            <boxGeometry args={[0.08, 0.02, 0.04]} />
            <meshStandardMaterial color="#D08B3A" />
          </mesh>
        </group>
      ))}
      <Blob length={0.3} width={0.2} opacity={0.25} />
    </group>
  );
}

type BirdProps = { index: number; active: boolean; reduced: boolean };

function Bird({ index, active, reduced }: BirdProps) {
  const ref = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null);
  const wingR = useRef<THREE.Group>(null);
  const radius = 22 + rand(index) * 12;
  const speed = 0.12 + rand(index + 7) * 0.06;
  const height = 11 + rand(index + 3) * 6;
  const start = rand(index + 11) * Math.PI * 2;

  useFrame((state) => {
    if (!ref.current || !active) return;
    // With reduced motion the birds hold a fixed pose along their path.
    const time = reduced ? 0 : state.clock.elapsedTime;
    const t = time * speed + start;
    const dx = -Math.sin(t) * radius;
    const dz = Math.cos(t) * radius * 0.5;
    ref.current.position.set(Math.cos(t) * radius, height + (reduced ? 0 : Math.sin(t * 2) * 0.6), Math.sin(t) * radius * 0.5 - 14);
    ref.current.rotation.y = Math.atan2(-dz, dx);
    const flap = reduced ? 0.3 : Math.sin(time * 10 + index) * 0.5;
    if (wingL.current) wingL.current.rotation.x = flap;
    if (wingR.current) wingR.current.rotation.x = -flap;
  });

  return (
    <group ref={ref} position={[0, height, 0]}>
      <mesh scale={[1.9, 0.7, 0.7]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.2, 0.03, 0]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.04, 0.16, 4]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <group ref={wingL} position={[0, 0.03, 0.04]}>
        <mesh position={[0, 0, 0.26]} scale={[0.09, 0.015, 0.26]}>
          <sphereGeometry args={[1, 8, 4]} />
          <meshStandardMaterial color="#2B2B2B" />
        </mesh>
      </group>
      <group ref={wingR} position={[0, 0.03, -0.04]}>
        <mesh position={[0, 0, -0.26]} scale={[0.09, 0.015, 0.26]}>
          <sphereGeometry args={[1, 8, 4]} />
          <meshStandardMaterial color="#2B2B2B" />
        </mesh>
      </group>
    </group>
  );
}

type CloudProps = { index: number; active: boolean; reduced: boolean };

const CLOUD_PUFFS: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 3.2], [2.8, 0.3, 0.6, 2.5], [-2.7, 0.1, -0.4, 2.3],
  [0.9, 1.5, 0, 2.2], [-1.2, 1.1, 0.8, 1.8], [4.9, -0.2, 0, 1.6], [-4.6, -0.2, 0.2, 1.5],
];

function Cloud({ index, active, reduced }: CloudProps) {
  const ref = useRef<THREE.Group>(null);
  const x0 = (rand(index) * 2 - 1) * 90;
  const y = 18 + rand(index + 5) * 8;
  const z = -30 - rand(index + 9) * 60;
  const speed = 0.25 + rand(index + 2) * 0.25;

  useFrame((state) => {
    if (!ref.current || !active || reduced) return;
    // Drift slowly and wrap around so the loop never jumps.
    const span = 180;
    const x = x0 + state.clock.elapsedTime * speed;
    ref.current.position.x = ((((x + 90) % span) + span) % span) - 90;
  });

  return (
    <group ref={ref} position={[x0, y, z]}>
      {CLOUD_PUFFS.map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} scale={[1, 0.72, 1]}>
          <sphereGeometry args={[r, 14, 10]} />
          <meshStandardMaterial color="#FFFFFF" roughness={1} emissive="#FFF4DC" emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Trees ----------

function Frond({ length, width, droop, color }: { length: number; width: number; droop: number; color: string }) {
  return (
    <group rotation={[droop, 0, 0]}>
      <mesh position={[0, 0, length / 2]} scale={[width, 0.03, length / 2]} castShadow>
        <sphereGeometry args={[1, 12, 6]} />
        <meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.02, length / 2]}>
        <boxGeometry args={[0.025, 0.02, length]} />
        <meshStandardMaterial color="#B6C97A" roughness={0.8} />
      </mesh>
    </group>
  );
}

type PalmProps = { kind: 'banana' | 'coconut'; position: [number, number, number]; phase: number; active: boolean; reduced: boolean };

function Palm({ kind, position, phase, active, reduced }: PalmProps) {
  const crown = useRef<THREE.Group>(null);
  const coconut = kind === 'coconut';
  const height = coconut ? 6.2 : 2.8;
  const leafCount = coconut ? 10 : 7;

  useFrame((state) => {
    if (!crown.current || !active || reduced) return;
    const t = state.clock.elapsedTime;
    crown.current.rotation.z = Math.sin(t * 0.9 + phase) * 0.05;
    crown.current.rotation.x = Math.cos(t * 0.7 + phase) * 0.03;
  });

  return (
    <group position={position}>
      <Blob length={coconut ? 1.4 : 1.8} width={coconut ? 1.4 : 1.8} opacity={0.18} />
      {coconut ? (
        // Gently curved trunk built from stacked, slightly narrowing rings.
        Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[(i / 5) ** 2 * 0.9, i * 1.05 + 0.55, 0]} rotation={[0, 0, -0.08 * i]} castShadow>
            <cylinderGeometry args={[0.15 - i * 0.012, 0.19 - i * 0.012, 1.1, 8]} />
            <meshStandardMaterial color={i % 2 ? '#7E5E3B' : '#8C6A44'} roughness={0.95} />
          </mesh>
        ))
      ) : (
        <mesh position={[0, height / 2, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.22, height, 10]} />
          <meshStandardMaterial color="#8FA05A" roughness={0.9} />
        </mesh>
      )}

      <group ref={crown} position={[coconut ? 0.9 : 0, height, 0]}>
        {Array.from({ length: leafCount }, (_, i) => (
          <group key={i} rotation={[0, (i / leafCount) * Math.PI * 2, 0]}>
            <Frond
              length={coconut ? 3.3 : 2.4}
              width={coconut ? 0.42 : 0.34}
              droop={coconut ? 0.35 : 0.55}
              color={i % 2 ? '#3E9B3A' : '#4DAA45'}
            />
          </group>
        ))}
        {coconut &&
          [[0.15, -0.25, 0.1], [-0.12, -0.3, -0.08], [0.02, -0.35, 0.16], [0.18, -0.32, -0.14]].map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.14, 10, 8]} />
              <meshStandardMaterial color="#7A5530" roughness={0.9} />
            </mesh>
          ))}
        {!coconut && (
          // Hanging banana bunch
          <group position={[0.25, -0.35, 0]}>
            {Array.from({ length: 8 }, (_, i) => (
              <mesh
                key={i}
                position={[Math.cos(i * 0.8) * 0.1, -0.1 - (i % 3) * 0.08, Math.sin(i * 0.8) * 0.1]}
                rotation={[0, 0, 0.25]}
              >
                <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
                <meshStandardMaterial color="#D9C43E" roughness={0.6} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    </group>
  );
}

// ---------- Village, landmarks, hills ----------

function Village() {
  const houses: [number, number][] = [[-30, -40], [-22, -44], [-6, -48], [12, -46], [26, -40]];
  return (
    <group>
      {houses.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[4, 3, 4]} />
            <meshStandardMaterial color="#F4EFE3" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.8, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[3.2, 1.6, 4]} />
            <meshStandardMaterial color="#B5562F" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.1, 2.01]}>
            <boxGeometry args={[0.9, 1.7, 0.05]} />
            <meshStandardMaterial color="#6B4A2E" roughness={0.9} />
          </mesh>
          <mesh position={[1.2, 1.8, 2.01]}>
            <boxGeometry args={[0.7, 0.7, 0.05]} />
            <meshStandardMaterial color="#3B5B7A" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Small temple with stacked tiers, as in the reference picture */}
      <group position={[-14, 0, -52]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 1 + i * 1.5, 0]} castShadow>
            <boxGeometry args={[4.2 - i * 1.1, 1.5, 4.2 - i * 1.1]} />
            <meshStandardMaterial color={i % 2 ? '#F2E4C9' : '#FFFFFF'} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 5.4, 0]}>
          <coneGeometry args={[0.8, 1.4, 8]} />
          <meshStandardMaterial color="#D9A441" roughness={0.5} />
        </mesh>
      </group>

      {/* Overhead water tank on legs */}
      <group position={[-26, 0, -34]}>
        {[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z], i) => (
          <mesh key={i} position={[x, 3, z]}>
            <cylinderGeometry args={[0.08, 0.08, 6, 6]} />
            <meshStandardMaterial color="#7C7C7C" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 6.8, 0]} castShadow>
          <cylinderGeometry args={[1.6, 1.6, 1.8, 16]} />
          <meshStandardMaterial color="#8E9AA3" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// Low, hazy hills in layers, so distance reads as depth.
function Hills() {
  const hills: [number, number, number, string][] = [
    [-70, -120, 30, '#6E9A6A'], [-25, -135, 38, '#7BA373'], [30, -130, 34, '#6E9A6A'],
    [80, -125, 32, '#7BA373'], [-110, -80, 26, '#7BA373'], [115, -70, 28, '#6E9A6A'],
  ];
  return (
    <group>
      {hills.map(([x, z, r, color], i) => (
        <mesh key={i} position={[x, -0.5, z]} scale={[r * 1.8, r * 0.42, r]}>
          <sphereGeometry args={[1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Ground() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(240, 240, 90, 90);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color('#7FA34C');
    const light = new THREE.Color('#9BB85A');
    const dark = new THREE.Color('#6B8F3E');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = 0.5 + 0.5 * Math.sin(x * 0.21) * Math.cos(z * 0.17) + (rand(Math.floor(x) * 7.1 + Math.floor(z) * 3.3) - 0.5) * 0.25;
      c.copy(base).lerp(n > 0.5 ? light : dark, Math.min(1, Math.abs(n - 0.5) * 1.8));
      colors.set([c.r, c.g, c.b], i * 3);
      const d = Math.hypot(x, z);
      // Keep the farm flat; roll the land gently far away.
      if (d > 55) pos.setY(i, (Math.sin(x * 0.13) + Math.cos(z * 0.11)) * 0.5 * Math.min(1, (d - 55) / 30));
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {/* Walking path from the garden to the shed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, 0.02, 0]} receiveShadow>
        <planeGeometry args={[2.4, 60]} />
        <meshStandardMaterial color="#B88A5A" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, 0.025, 0]}>
        <planeGeometry args={[1.1, 60]} />
        <meshStandardMaterial color="#A57B4E" roughness={1} />
      </mesh>
    </group>
  );
}

// Sunrise gradient on the inside of a large sphere, with a soft sun and glow.
function SkyDome() {
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(190, 32, 16);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#8EC5F0');
    const mid = new THREE.Color('#D8ECF7');
    const horizon = new THREE.Color('#FBD9A0');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = THREE.MathUtils.clamp(pos.getY(i) / 190, 0, 1);
      if (h < 0.35) c.copy(horizon).lerp(mid, h / 0.35);
      else c.copy(mid).lerp(top, (h - 0.35) / 0.65);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  return (
    <group>
      <mesh geometry={geometry} renderOrder={-1}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} />
      </mesh>
      <mesh position={[-60, 14, -100]}>
        <sphereGeometry args={[4.5, 24, 16]} />
        <meshBasicMaterial color="#FFF1C2" fog={false} />
      </mesh>
      <mesh position={[-60, 14, -100]}>
        <sphereGeometry args={[12, 24, 16]} />
        <meshBasicMaterial color="#FFD58A" transparent opacity={0.28} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

// ---------- Shed ----------

function Shed({ active, reduced }: { active: boolean; reduced: boolean }) {
  const slats = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({ x: -3.55 + i * 0.34, tone: i % 2 ? '#8B5A2B' : '#7C4F25' })),
    [],
  );
  return (
    <group position={[10, 0, 0]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[7.6, 0.25, 4.4]} />
        <meshStandardMaterial color="#B7AE9C" roughness={0.9} />
      </mesh>
      {/* Plank back wall */}
      {slats.map((s, i) => (
        <mesh key={i} position={[s.x, 1.4, -1.95]} castShadow>
          <boxGeometry args={[0.33, 2.4, 0.06]} />
          <meshStandardMaterial color={s.tone} roughness={0.9} />
        </mesh>
      ))}
      {[-3.6, 3.6].flatMap((x) =>
        [-1.95, 1.95].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.6, z]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 3.1, 8]} />
            <meshStandardMaterial color="#7A5230" roughness={0.9} />
          </mesh>
        )),
      )}
      {/* Gable roof: two sloping panels with a ridge cap and front fascia */}
      <mesh position={[0, 3.6, 1.2]} rotation={[0.45, 0, 0]} castShadow>
        <boxGeometry args={[8, 0.14, 2.8]} />
        <meshStandardMaterial color="#A8552B" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.6, -1.2]} rotation={[-0.45, 0, 0]} castShadow>
        <boxGeometry args={[8, 0.14, 2.8]} />
        <meshStandardMaterial color="#A8552B" roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.0, 0]}>
        <boxGeometry args={[8.1, 0.12, 0.3]} />
        <meshStandardMaterial color="#8C4521" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.22, 2.45]}>
        <boxGeometry args={[8, 0.12, 0.08]} />
        <meshStandardMaterial color="#6B4A2E" roughness={0.9} />
      </mesh>
      {/* Feeding trough and straw bedding */}
      <mesh position={[0, 0.5, 1.9]}>
        <boxGeometry args={[7, 0.4, 0.5]} />
        <meshStandardMaterial color="#9A9A8E" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0.3]}>
        <boxGeometry args={[6.4, 0.08, 1.3]} />
        <meshStandardMaterial color="#D9B25A" roughness={1} />
      </mesh>
      {[-2.8, -0.6, 1.8, 3.0].map((x, i) => (
        <mesh key={x} position={[x, 0.42, 1.0 + (i % 2) * 0.4]} scale={[1, 0.45, 0.8]}>
          <sphereGeometry args={[0.45, 10, 8]} />
          <meshStandardMaterial color="#D9B25A" roughness={1} />
        </mesh>
      ))}

      <RealCow position={[-2.6, 0.25, -0.3]} rotation={-Math.PI / 2} scale={1.3} body="#C47A3E" spots phase={0} active={active} reduced={reduced} />
      <RealCow position={[0.2, 0.25, -0.6]} rotation={-Math.PI / 2} scale={1.3} body="#E3D2BA" phase={1.3} active={active} reduced={reduced} />
      <RealCow position={[2.6, 0.25, -0.2]} rotation={-Math.PI / 2} scale={1.3} body="#B9825A" spots phase={2.6} active={active} reduced={reduced} />
      <RealCow position={[-0.8, 0.25, 0.7]} rotation={-Math.PI / 2} scale={0.8} body="#C68B52" phase={3.9} active={active} reduced={reduced} />
    </group>
  );
}

// ---------- Farm root ----------

export default function Farm({ active, reduced, mobile }: Props) {
  const palms = mobile ? PALMS.slice(0, 3) : PALMS;
  const birdCount = mobile ? 5 : 9;
  const cloudCount = mobile ? 3 : 6;
  const henCount = mobile ? 5 : 9;

  return (
    <group>
      <SkyDome />
      <Hills />
      <Village />
      <Ground />
      <Grass count={mobile ? 260 : 600} />
      <Flowers count={mobile ? 90 : 220} />
      <Garden />
      <Shed active={active} reduced={reduced} />
      <Safe fallback={null}>
        <WheatField x0={13} x1={21.5} z0={5} z1={14} count={mobile ? 110 : 220} active={active} reduced={reduced} />
      </Safe>

      <RealCow position={[9.5, 0, 6.5]} rotation={-0.6} scale={1.0} body="#D2A67C" phase={0.7} active={active} reduced={reduced} />
      <RealCow position={[6.5, 0, 12]} rotation={-1.1} scale={0.9} body="#C47A3E" spots phase={2.1} active={active} reduced={reduced} />
      <RealCow position={[11.5, 0, 9.5]} rotation={-0.9} scale={0.7} body="#C68B52" phase={3.3} active={active} reduced={reduced} />

      {palms.map((p, i) => (
        <Palm key={i} kind={p.kind} position={p.position} phase={i * 0.9} active={active} reduced={reduced} />
      ))}

      {Array.from({ length: henCount }, (_, i) => {
        const colors = ['#FFFFFF', '#A0522D', '#E6E0D4', '#8B5A2B'];
        const rooster = i % 5 === 0;
        return (
          <Chicken
            key={i}
            index={i}
            cx={2}
            cz={7}
            radius={2 + rand(i + 20) * 1.8}
            color={rooster ? '#2B2B2B' : colors[i % colors.length]}
            big={rooster}
            active={active}
            reduced={reduced}
          />
        );
      })}

      {Array.from({ length: birdCount }, (_, i) => (
        <Bird key={i} index={i} active={active} reduced={reduced} />
      ))}
      {Array.from({ length: cloudCount }, (_, i) => (
        <Cloud key={i} index={i} active={active} reduced={reduced} />
      ))}
    </group>
  );
}
