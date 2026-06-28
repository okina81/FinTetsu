import fs from 'node:fs';

// ===== 1. Load real Japanese cities =====================================
const all = JSON.parse(fs.readFileSync('cities.json', 'utf8'));
let cities = all
  .filter((c) => c.country === 'JP')
  .map((c) => ({
    name: c.name,
    lat: parseFloat(c.lat),
    lng: parseFloat(c.lng),
  }))
  .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
  // 本土＋主要島の範囲にクリップ（離島の極端値を除外）
  .filter((c) => c.lng >= 127 && c.lng <= 146 && c.lat >= 26 && c.lat <= 46);

// 名前の重複を除去（最初の1件）
const seenName = new Set();
cities = cities.filter((c) => {
  const k = c.name.toLowerCase();
  if (seenName.has(k)) return false;
  seenName.add(k);
  return true;
});

// ===== 2. Slug + 主要都市の優先 =========================================
const deburr = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slugify = (s) =>
  deburr(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);

// 必ず入れたい著名都市（romaji 名で一致）。プレイヤー開始都市もここから。
const MAJORS = [
  'Tokyo',
  'Yokohama',
  'Osaka',
  'Nagoya',
  'Sapporo',
  'Fukuoka',
  'Kobe',
  'Kyoto',
  'Kawasaki',
  'Saitama',
  'Hiroshima',
  'Sendai',
  'Chiba',
  'Kitakyushu',
  'Sakai',
  'Niigata',
  'Hamamatsu',
  'Kumamoto',
  'Sagamihara',
  'Okayama',
  'Shizuoka',
  'Kagoshima',
  'Matsuyama',
  'Kanazawa',
  'Utsunomiya',
  'Oita',
  'Naha',
  'Nagasaki',
  'Toyama',
  'Akita',
  'Aomori',
  'Morioka',
  'Fukushima',
  'Mito',
  'Maebashi',
  'Nagano',
  'Gifu',
  'Tsu',
  'Otsu',
  'Nara',
  'Wakayama',
  'Tottori',
  'Matsue',
  'Yamaguchi',
  'Tokushima',
  'Takamatsu',
  'Kochi',
  'Saga',
  'Miyazaki',
  'Fukui',
  'Kofu',
  'Hakodate',
  'Asahikawa',
  'Obihiro',
];
const majorSet = new Set(MAJORS.map((m) => m.toLowerCase()));

// ===== 3. Spatial thinning to ~target ===================================
const TARGET = 350;
// majors first, then the rest in original order
cities.sort((a, b) => {
  const am = majorSet.has(a.name.toLowerCase()) ? 0 : 1;
  const bm = majorSet.has(b.name.toLowerCase()) ? 0 : 1;
  return am - bm;
});

function greedyThin(minDeg) {
  const kept = [];
  for (const c of cities) {
    let ok = true;
    for (const k of kept) {
      const dx = (c.lng - k.lng) * 0.8;
      const dy = c.lat - k.lat;
      if (dx * dx + dy * dy < minDeg * minDeg) {
        ok = false;
        break;
      }
    }
    if (ok) kept.push(c);
  }
  return kept;
}

// minDeg を二分探索して TARGET 近辺に
let lo = 0.05,
  hi = 0.6,
  kept = [];
for (let iter = 0; iter < 24; iter++) {
  const mid = (lo + hi) / 2;
  kept = greedyThin(mid);
  if (kept.length > TARGET) lo = mid;
  else hi = mid;
}
console.log(
  `thinned to ${kept.length} stations (minDeg≈${((lo + hi) / 2).toFixed(3)})`,
);

// ===== 4. Projection into a large board =================================
const lats = kept.map((c) => c.lat);
const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
const kx = Math.cos((latMid * Math.PI) / 180);
const raw = kept.map((c) => ({ ...c, rx: c.lng * kx, ry: -c.lat }));
const minX = Math.min(...raw.map((r) => r.rx));
const maxX = Math.max(...raw.map((r) => r.rx));
const minY = Math.min(...raw.map((r) => r.ry));
const maxY = Math.max(...raw.map((r) => r.ry));

const PAD = 120;
const BOARD_W = 2200;
const scale = (BOARD_W - 2 * PAD) / (maxX - minX);
const BOARD_H = Math.round((maxY - minY) * scale + 2 * PAD);
const project = (lng, lat) => [
  Math.round((lng * kx - minX) * scale + PAD),
  Math.round((-lat - minY) * scale + PAD),
];

// ===== 5. Assign id / type / pop / industry (seeded) ====================
let seed = 1234567;
const rng = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const TYPES = ['financial', 'tourism', 'industrial', 'agriculture', 'rural'];
const TOURISM = new Set(
  [
    'kyoto',
    'naha',
    'hakodate',
    'nara',
    'kanazawa',
    'nikko',
    'beppu',
    'matsumoto',
    'karuizawa',
    'kamakura',
  ].map((s) => s),
);
const usedId = new Set();
const stations = kept.map((c) => {
  let id = slugify(c.name) || 'city';
  let base = id,
    n = 2;
  while (usedId.has(id)) id = `${base}${n++}`;
  usedId.add(id);
  const [x, y] = project(c.lng, c.lat);
  const isMajor = majorSet.has(c.name.toLowerCase());
  let type;
  if (
    isMajor &&
    ['tokyo', 'osaka', 'nagoya', 'yokohama', 'fukuoka'].includes(id)
  ) {
    type = 'financial';
  } else if (TOURISM.has(id)) {
    type = 'tourism';
  } else {
    const r = rng();
    type =
      r < 0.1
        ? 'financial'
        : r < 0.32
          ? 'tourism'
          : r < 0.57
            ? 'industrial'
            : r < 0.8
              ? 'agriculture'
              : 'rural';
  }
  const popBase = isMajor ? 70 : 25;
  const population = Math.min(100, Math.round(popBase + rng() * 30));
  const industryIndex = Math.min(
    100,
    Math.round((isMajor ? 65 : 30) + rng() * 35),
  );
  return { id, name: c.name, type, x, y, population, industryIndex };
});

// ===== 6. Routes: MST + k-nearest extra edges ===========================
const N = stations.length;
const dist2 = (a, b) => {
  const dx = a.x - b.x,
    dy = a.y - b.y;
  return dx * dx + dy * dy;
};
// Prim MST
const inTree = new Array(N).fill(false);
const best = new Array(N).fill(Infinity);
const parent = new Array(N).fill(-1);
best[0] = 0;
const edges = new Set();
const addEdge = (i, j) => {
  if (i === j) return;
  const k = i < j ? `${i}-${j}` : `${j}-${i}`;
  edges.add(k);
};
for (let it = 0; it < N; it++) {
  let u = -1;
  for (let v = 0; v < N; v++)
    if (!inTree[v] && (u === -1 || best[v] < best[u])) u = v;
  inTree[u] = true;
  if (parent[u] !== -1) addEdge(u, parent[u]);
  for (let v = 0; v < N; v++) {
    if (!inTree[v]) {
      const d = dist2(stations[u], stations[v]);
      if (d < best[v]) {
        best[v] = d;
        parent[v] = u;
      }
    }
  }
}
// extra edges: connect each node to nearest neighbors to form loops/branches
const MAX_EXTRA_LEN2 = Math.pow(scale * 0.9, 2); // ~0.9° 以内のみ
for (let i = 0; i < N; i++) {
  const cand = [];
  for (let j = 0; j < N; j++) {
    if (i === j) continue;
    const d = dist2(stations[i], stations[j]);
    if (d < MAX_EXTRA_LEN2) cand.push([d, j]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  for (let n = 0; n < Math.min(2, cand.length); n++) addEdge(i, cand[n][1]);
}
const routes = [...edges].map((k) => {
  const [i, j] = k.split('-').map(Number);
  return { from: stations[i].id, to: stations[j].id };
});
console.log(
  `routes: ${routes.length} (avg degree ${((routes.length * 2) / N).toFixed(2)})`,
);

// connectivity check (BFS)
const adj = {};
for (const r of routes) {
  (adj[r.from] ??= []).push(r.to);
  (adj[r.to] ??= []).push(r.from);
}
const seen = new Set([stations[0].id]);
const q = [stations[0].id];
while (q.length) {
  const u = q.pop();
  for (const v of adj[u] ?? [])
    if (!seen.has(v)) {
      seen.add(v);
      q.push(v);
    }
}
console.log(`connected: ${seen.size}/${N}`);

// ===== 7. Coastline reprojected with same transform =====================
const gj = JSON.parse(fs.readFileSync('ne50.geojson', 'utf8'));
const jp = gj.features.find(
  (f) => (f.properties.ADMIN || f.properties.NAME) === 'Japan',
);
let rings = (
  jp.geometry.type === 'Polygon'
    ? [jp.geometry.coordinates]
    : jp.geometry.coordinates
).map((p) => p[0]);
rings = rings.filter((r) =>
  r.some(([lo2, la]) => lo2 >= 125 && lo2 <= 146 && la >= 24.5 && la <= 46),
);
function dp(points, tol) {
  if (points.length < 3) return points;
  let idx = -1,
    max = 0;
  const a = points[0],
    b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1e-9),
      ),
    );
    const px = a[0] + t * dx,
      py = a[1] + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max > tol)
    return dp(points.slice(0, idx + 1), tol)
      .slice(0, -1)
      .concat(dp(points.slice(idx), tol));
  return [a, b];
}
const coast = rings
  .map((r) => dp(r, 0.03))
  .filter((r) => r.length >= 4)
  .map((r) => r.map(([lo2, la]) => project(lo2, la)));

// ===== 8. Emit =========================================================
const round = (n) => Math.round(n);
const out = `// AUTO-GENERATED by scripts/build-stations (GeoNames via lutangar/cities.json + Natural Earth 50m).
// 約${N}駅の実在都市（緯度経度→大型ボード座標へ投影）と、近接グラフで生成した路線、
// 同一投影の海岸線シルエット。本家規模のマップ用データ。
import type { City, Route } from './types';

export const BOARD_W = ${BOARD_W};
export const BOARD_H = ${BOARD_H};

export const STATIONS: City[] = ${JSON.stringify(stations)};

export const STATION_ROUTES: Route[] = ${JSON.stringify(routes)};

export const JAPAN_PATHS: number[][][] = ${JSON.stringify(coast.map((r) => r.map(([x, y]) => [round(x), round(y)])))};
`;
fs.writeFileSync('stationsData.generated.ts', out);
console.log(
  `board ${BOARD_W}x${BOARD_H}, file ${(out.length / 1024).toFixed(0)} KB`,
);
console.log(
  'start-city ids present?',
  ['tokyo', 'osaka', 'fukuoka', 'sapporo']
    .map((id) => `${id}:${usedId.has(id)}`)
    .join(' '),
);
