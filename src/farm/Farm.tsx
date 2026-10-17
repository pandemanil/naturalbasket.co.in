import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

// ---------- Instanced plants ----------

type Item = { x: number; y: number; z: number; s: number; sy?: number; r?: number; color?: string };

// One InstancedMesh draws every plant of a kind in a single GPU call.
function Instanced({ items, children }: { items: Item[]; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.scale.set(it.s, it.sy ?? it.s, it.s);
      dummy.rotation.set(0, it.r ?? 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (it.color) mesh.setColorAt(i, color.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow>
      {children}
    </instancedMesh>
  );
}

function Garden() {
  const data = useMemo(() => {
    const leafy: Item[] = [];
    const foliage: Item[] = [];
    const stakes: Item[] = [];
    const fruit: Item[] = [];
    const carrots: Item[] = [];
    const carrotTops: Item[] = [];

    ROW_X.forEach((x, r) => {
      PLANT_Z.forEach((z, c) => {
        const k = r * 100 + c;
        const px = x + (rand(k) - 0.5) * 0.3;
        const pz = z + (rand(k + 0.5) - 0.5) * 0.3;
        const kind = r === 0 || r === 3 ? 'tomato' : r === 2 ? 'carrot' : 'leafy';

        if (kind === 'tomato') {
          foliage.push({ x: px, y: 0.6, z: pz, s: 0.5 + rand(k) * 0.15, sy: 0.75, color: '#3E8E3E' });
          stakes.push({ x: px, y: 0.8, z: pz, s: 1 });
          fruit.push({ x: px + 0.22, y: 0.5 + rand(k + 2) * 0.2, z: pz + 0.12, s: 1, color: '#D7261E' });
          fruit.push({ x: px - 0.18, y: 0.4 + rand(k + 3) * 0.2, z: pz - 0.1, s: 1, color: '#E24B2A' });
        } else if (kind === 'carrot') {
          carrots.push({ x: px, y: 0.26, z: pz, s: 1, color: '#E8731E' });
          carrotTops.push({ x: px, y: 0.55, z: pz, s: 0.8, sy: 0.9, color: '#3C8D3C' });
        } else {
          leafy.push({
            x: px, y: 0.22, z: pz, s: 0.45 + rand(k) * 0.15, sy: 0.5,
            color: r === 4 ? '#2F7D32' : rand(k + 4) > 0.5 ? '#4CA64C' : '#3F8F3F',
          });
        }
      });
    });

    return { leafy, foliage, stakes, fruit, carrots, carrotTops };
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
        <sphereGeometry args={[0.42, 8, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </Instanced>
      <Instanced items={data.foliage}>
        <sphereGeometry args={[0.4, 8, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </Instanced>
      <Instanced items={data.stakes}>
        <cylinderGeometry args={[0.03, 0.03, 1.5, 5]} />
        <meshStandardMaterial color="#C9A96A" roughness={0.9} />
      </Instanced>
      <Instanced items={data.fruit}>
        <sphereGeometry args={[0.14, 8, 6]} />
        <meshStandardMaterial roughness={0.4} />
      </Instanced>
      <Instanced items={data.carrots}>
        <coneGeometry args={[0.12, 0.45, 8]} />
        <meshStandardMaterial roughness={0.8} />
      </Instanced>
      <Instanced items={data.carrotTops}>
        <sphereGeometry args={[0.2, 6, 5]} />
        <meshStandardMaterial roughness={0.9} />
      </Instanced>

      {/* Bamboo fence along the garden edges */}
      <mesh position={[-10.3, 0.5, 8.9]}>
        <boxGeometry args={[12.5, 0.08, 0.08]} />
        <meshStandardMaterial color="#B89A5E" roughness={0.9} />
      </mesh>
      <mesh position={[-16.4, 0.5, 0]}>
        <boxGeometry args={[0.08, 0.08, 18.5]} />
        <meshStandardMaterial color="#B89A5E" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ---------- Animated animals ----------

type CowProps = {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
  body?: string;
  spots?: boolean;
  phase: number;
  active: boolean;
  reduced: boolean;
};

function Cow({ position, rotation = 0, scale = 1, body = '#B9825A', spots = false, phase, active, reduced }: CowProps) {
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!active || reduced) return;
    const t = state.clock.elapsedTime;
    if (head.current) head.current.rotation.z = -0.3 + Math.sin(t * 0.7 + phase) * 0.08;
    if (tail.current) tail.current.rotation.z = Math.sin(t * 2.2 + phase) * 0.35;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[1.6, 0.72, 0.72]} />
        <meshStandardMaterial color={body} roughness={0.8} />
      </mesh>
      {spots && (
        <>
          <mesh position={[0.1, 1.02, 0.37]}>
            <boxGeometry args={[0.5, 0.32, 0.02]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
          <mesh position={[-0.4, 1.0, -0.37]}>
            <boxGeometry args={[0.4, 0.28, 0.02]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
        </>
      )}
      {/* Udder */}
      <mesh position={[-0.2, 0.55, 0]}>
        <boxGeometry args={[0.3, 0.14, 0.3]} />
        <meshStandardMaterial color="#E8A6A0" />
      </mesh>
      {[-0.6, 0.6].flatMap((x) =>
        [-0.25, 0.25].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.35, z]} castShadow>
            <cylinderGeometry args={[0.08, 0.07, 0.7, 8]} />
            <meshStandardMaterial color="#6B4A2E" />
          </mesh>
        )),
      )}
      {/* Head pivots at the neck so it can graze gently */}
      <group ref={head} position={[0.85, 1.25, 0]}>
        <mesh position={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.45, 0.42]} />
          <meshStandardMaterial color={body} roughness={0.8} />
        </mesh>
        <mesh position={[0.5, -0.1, 0]}>
          <boxGeometry args={[0.22, 0.2, 0.36]} />
          <meshStandardMaterial color="#D9A39A" />
        </mesh>
        {[-0.15, 0.15].map((z) => (
          <mesh key={z} position={[0.02, 0.27, z]} rotation={[0, 0, 0.5]}>
            <coneGeometry args={[0.04, 0.22, 6]} />
            <meshStandardMaterial color="#EFE7D2" />
          </mesh>
        ))}
      </group>
      {/* Tail pivots at the rump */}
      <group ref={tail} position={[-0.8, 1.15, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 5]} />
          <meshStandardMaterial color="#6B4A2E" />
        </mesh>
      </group>
    </group>
  );
}

type HenProps = { index: number; cx: number; cz: number; radius: number; color: string; big?: boolean; active: boolean; reduced: boolean };

function Chicken({ index, cx, cz, radius, color, big = false, active, reduced }: HenProps) {
  const ref = useRef<THREE.Group>(null);
  const scale = big ? 1.25 : 1;

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
      <mesh position={[0, 0.2, 0]} scale={[1.3, 1, 1]} castShadow>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0.22, 0.4, 0]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0.33, 0.37, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.04, 0.08, 6]} />
        <meshStandardMaterial color="#E0A030" />
      </mesh>
      <mesh position={[0.22, 0.52, 0]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshStandardMaterial color="#C81E1E" />
      </mesh>
      <mesh position={[-0.24, 0.32, 0]} rotation={[0, 0, Math.PI / 4]}>
        <coneGeometry args={[0.1, 0.22, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[-0.04, 0.04].map((z) => (
        <mesh key={z} position={[0, 0.05, z]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 5]} />
          <meshStandardMaterial color="#D08B3A" />
        </mesh>
      ))}
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
      <mesh>
        <boxGeometry args={[0.32, 0.08, 0.1]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <group ref={wingL} position={[0, 0.02, 0.04]}>
        <mesh position={[0, 0, 0.22]}>
          <boxGeometry args={[0.1, 0.02, 0.42]} />
          <meshStandardMaterial color="#2B2B2B" />
        </mesh>
      </group>
      <group ref={wingR} position={[0, 0.02, -0.04]}>
        <mesh position={[0, 0, -0.22]}>
          <boxGeometry args={[0.1, 0.02, 0.42]} />
          <meshStandardMaterial color="#2B2B2B" />
        </mesh>
      </group>
    </group>
  );
}

type CloudProps = { index: number; active: boolean; reduced: boolean };

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
      {([[0, 0, 0, 3.2], [2.6, 0.4, 0.6, 2.4], [-2.4, 0.2, -0.4, 2.2], [0.8, 1.4, 0, 2]] as const).map(
        ([px, py, pz, r], i) => (
          <mesh key={i} position={[px, py, pz]}>
            <sphereGeometry args={[r, 12, 10]} />
            <meshStandardMaterial color="#FFFFFF" roughness={1} />
          </mesh>
        ),
      )}
    </group>
  );
}

// ---------- Trees ----------

function Palm({ kind, position, phase, active, reduced }: { kind: 'banana' | 'coconut'; position: [number, number, number]; phase: number; active: boolean; reduced: boolean }) {
  const crown = useRef<THREE.Group>(null);
  const coconut = kind === 'coconut';
  const height = coconut ? 6.2 : 2.8;
  const leafLength = coconut ? 3.2 : 2.4;
  const droop = coconut ? 0.35 : 0.5;
  const leafCount = coconut ? 9 : 7;

  useFrame((state) => {
    if (!crown.current || !active || reduced) return;
    const t = state.clock.elapsedTime;
    crown.current.rotation.z = Math.sin(t * 0.9 + phase) * 0.05;
    crown.current.rotation.x = Math.cos(t * 0.7 + phase) * 0.03;
  });

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.2, height, 8]} />
        <meshStandardMaterial color="#8C6A44" roughness={0.9} />
      </mesh>
      <group ref={crown} position={[0, height, 0]}>
        {Array.from({ length: leafCount }, (_, i) => (
          <group key={i} rotation={[0, (i / leafCount) * Math.PI * 2, 0]}>
            <group rotation={[droop, 0, 0]}>
              <mesh position={[0, 0, leafLength / 2]} castShadow>
                <boxGeometry args={[0.36, 0.03, leafLength]} />
                <meshStandardMaterial color={i % 2 ? '#3E9B3A' : '#4DAA45'} roughness={0.7} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
        ))}
        {coconut &&
          [[0.15, -0.25, 0.1], [-0.12, -0.3, -0.08], [0.02, -0.35, 0.16]].map(([x, y, z], i) => (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.13, 8, 6]} />
              <meshStandardMaterial color="#7A5530" />
            </mesh>
          ))}
      </group>
    </group>
  );
}

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
        </group>
      ))}
    </group>
  );
}

function Hills() {
  const hills: [number, number, number][] = [[-60, -95, 22], [-20, -110, 30], [25, -100, 26], [70, -120, 36]];
  return (
    <group>
      {hills.map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0, z]} scale={[r * 1.6, r * 0.9, r]}>
          <sphereGeometry args={[1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#5E8B5B" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[80, 64]} />
        <meshStandardMaterial color="#86A953" roughness={1} />
      </mesh>
      {/* Walking path from the garden to the shed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, 0.02, 0]} receiveShadow>
        <planeGeometry args={[2.4, 60]} />
        <meshStandardMaterial color="#B88A5A" roughness={1} />
      </mesh>
    </group>
  );
}

// Sunrise gradient on the inside of a large sphere.
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
      <mesh position={[-60, 16, -90]}>
        <sphereGeometry args={[5, 24, 16]} />
        <meshBasicMaterial color="#FFE7A3" fog={false} />
      </mesh>
    </group>
  );
}

// ---------- Shed ----------

function Shed({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <group position={[10, 0, 0]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[7.6, 0.25, 4.4]} />
        <meshStandardMaterial color="#B7AE9C" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.4, -1.95]} castShadow>
        <boxGeometry args={[7.6, 2.4, 0.15]} />
        <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
      </mesh>
      {[-3.6, 3.6].flatMap((x) =>
        [-1.95, 1.95].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 1.6, z]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 3.1, 8]} />
            <meshStandardMaterial color="#7A5230" roughness={0.9} />
          </mesh>
        )),
      )}
      {/* Gable roof: two sloping panels meeting at a ridge */}
      <mesh position={[0, 3.6, 1.2]} rotation={[0.45, 0, 0]} castShadow>
        <boxGeometry args={[8, 0.14, 2.8]} />
        <meshStandardMaterial color="#A8552B" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.6, -1.2]} rotation={[-0.45, 0, 0]} castShadow>
        <boxGeometry args={[8, 0.14, 2.8]} />
        <meshStandardMaterial color="#A8552B" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.5, 1.9]}>
        <boxGeometry args={[7, 0.4, 0.5]} />
        <meshStandardMaterial color="#9A9A8E" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0.3]}>
        <boxGeometry args={[6.4, 0.08, 1.3]} />
        <meshStandardMaterial color="#D9B25A" roughness={1} />
      </mesh>

      <Cow position={[-2.6, 0.25, -0.3]} rotation={-Math.PI / 2} body="#C47A3E" spots phase={0} active={active} reduced={reduced} />
      <Cow position={[0.2, 0.25, -0.6]} rotation={-Math.PI / 2} body="#E9E4D8" phase={1.3} active={active} reduced={reduced} />
      <Cow position={[2.6, 0.25, -0.2]} rotation={-Math.PI / 2} body="#B9825A" spots phase={2.6} active={active} reduced={reduced} />
      <Cow position={[-0.8, 0.25, 0.7]} rotation={-Math.PI / 2} scale={0.6} body="#C68B52" phase={3.9} active={active} reduced={reduced} />
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
      <Garden />
      <Shed active={active} reduced={reduced} />

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
