// Client-side contour extraction for scanned topographic maps.
// Detects brown contour lines via HSV color filtering, cleans the mask,
// skeletonizes it (Zhang-Suen), traces the skeleton into polylines, and
// simplifies them (Douglas-Peucker). All vector output is in image pixel
// space (x right, y down for SVG; y flipped up for GeoJSON).

const MAX_DIM = 1400;

export async function loadImageFromSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the map image."));
    img.src = src;
  });
}

// sensitivity 0..100 -> chromaMin 90..10 (higher sensitivity = looser threshold)
function detectBrownMask(data, w, h, sensitivity) {
  const chromaMin = 90 - (sensitivity / 100) * 80;
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    if (chroma < chromaMin) continue;
    const v = max / 255;
    if (v < 0.12 || v > 0.92) continue;
    let hue;
    if (max === r) hue = 60 * (((g - b) / chroma) % 6);
    else if (max === g) hue = 60 * ((b - r) / chroma + 2);
    else hue = 60 * ((r - g) / chroma + 4);
    if (hue < 0) hue += 360;
    // brown / sepia contour hue range
    if (hue >= 8 && hue <= 50) mask[p] = 1;
  }
  return mask;
}

// Remove fully isolated pixels; keep anything with at least one neighbor.
function despeckle(mask, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      let count = 0;
      for (let dy = -1; dy <= 1 && count === 0; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (mask[ny * w + nx]) {
            count++;
            break;
          }
        }
      }
      if (count >= 1) out[i] = 1;
    }
  }
  return out;
}

// Zhang-Suen thinning to a 1px skeleton.
function thinZhangSuen(mask, w, h) {
  const img = new Uint8Array(mask);
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const toRemove = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!img[i]) continue;
          const P = [
            img[(y - 1) * w + x],
            img[(y - 1) * w + (x + 1)],
            img[y * w + (x + 1)],
            img[(y + 1) * w + (x + 1)],
            img[(y + 1) * w + x],
            img[(y + 1) * w + (x - 1)],
            img[y * w + (x - 1)],
            img[(y - 1) * w + (x - 1)],
          ];
          let A = 0;
          for (let k = 0; k < 8; k++) {
            if (P[k] === 0 && P[(k + 1) % 8] === 1) A++;
          }
          if (A !== 1) continue;
          let B = 0;
          for (let k = 0; k < 8; k++) if (P[k]) B++;
          if (B < 2 || B > 6) continue;
          if (pass === 0) {
            if (P[0] && P[2] && P[4]) continue;
            if (P[2] && P[4] && P[6]) continue;
          } else {
            if (P[0] && P[2] && P[6]) continue;
            if (P[0] && P[4] && P[6]) continue;
          }
          toRemove.push(i);
        }
      }
      if (toRemove.length) {
        changed = true;
        for (const i of toRemove) img[i] = 0;
      }
    }
  }
  return img;
}

function neighbors8(i, w, h, skel) {
  const x = i % w;
  const y = (i / w) | 0;
  const res = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (skel[j]) res.push(j);
    }
  }
  return res;
}

function tracePolylines(skel, w, h) {
  const visited = new Uint8Array(w * h);
  const polylines = [];
  const endpoints = [];
  for (let i = 0; i < w * h; i++) {
    if (!skel[i]) continue;
    if (neighbors8(i, w, h, skel).length === 1) endpoints.push(i);
  }
  const walk = (start) => {
    const path = [start];
    visited[start] = 1;
    let cur = start;
    while (true) {
      const ns = neighbors8(cur, w, h, skel).filter((j) => !visited[j]);
      if (!ns.length) break;
      const nxt = ns[0];
      visited[nxt] = 1;
      path.push(nxt);
      cur = nxt;
    }
    cur = start;
    while (true) {
      const ns = neighbors8(cur, w, h, skel).filter((j) => !visited[j]);
      if (!ns.length) break;
      const nxt = ns[0];
      visited[nxt] = 1;
      path.unshift(nxt);
      cur = nxt;
    }
    polylines.push(path);
  };
  for (const ep of endpoints) if (!visited[ep]) walk(ep);
  for (let i = 0; i < w * h; i++) if (skel[i] && !visited[i]) walk(i);
  return polylines.map((p) => p.map((i) => [i % w, (i / w) | 0]));
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a[0] + t * dx;
  const py = a[1] + t * dy;
  return Math.hypot(p[0] - px, p[1] - py);
}

function simplifyDP(pts, eps) {
  if (pts.length <= 2) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let dmax = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > dmax) {
        dmax = d;
        idx = i;
      }
    }
    if (dmax > eps && idx > -1) {
      keep[idx] = true;
      stack.push([s, idx]);
      stack.push([idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function polylineLength(p) {
  let len = 0;
  for (let i = 1; i < p.length; i++) {
    len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  }
  return len;
}

export function extractContours(image, sensitivity = 50) {
  let w = image.naturalWidth;
  let h = image.naturalHeight;
  if (Math.max(w, h) > MAX_DIM) {
    const scale = MAX_DIM / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  let mask = detectBrownMask(data, w, h, sensitivity);
  mask = despeckle(mask, w, h);
  const skel = thinZhangSuen(mask, w, h);
  let polylines = tracePolylines(skel, w, h);
  polylines = polylines
    .map((p) => simplifyDP(p, 1.5))
    .filter((p) => p.length >= 2 && polylineLength(p) >= 6);

  return {
    width: w,
    height: h,
    contours: polylines,
    contour_count: polylines.length,
  };
}

export function buildSvg(contours, w, h) {
  const d = contours
    .map(
      (pl) =>
        "M " + pl.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ")
    )
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g fill="none" stroke="#c2410c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g></svg>`;
}

export function buildGeoJson(contours, h) {
  const features = contours
    .filter((p) => p.length >= 2)
    .map((pl) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: pl.map((p) => [
          Number(p[0].toFixed(2)),
          Number((h - p[1]).toFixed(2)),
        ]),
      },
      properties: {},
    }));
  return { type: "FeatureCollection", features };
}

export function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}