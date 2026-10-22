// Renders the app icon, adaptive icon layers, splash and favicon from the Petal Compass.
// Needs playwright-core and a Chromium build: CHROME=/path/to/chrome node scripts/make-icons.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const OUT = new URL('../assets', import.meta.url).pathname;
const petal = (len, w) => `M 0 0 C ${-w} ${-len*0.35}, ${-w*0.85} ${-len*0.88}, 0 ${-len} C ${w*0.85} ${-len*0.88}, ${w} ${-len*0.35}, 0 0 Z`;
const arc = (r, a0, a1) => { const p = a => [r*Math.sin(a), -r*Math.cos(a)]; const [x0,y0]=p(a0),[x1,y1]=p(a1); return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1-a0>Math.PI?1:0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
// bloom centred at 0,0 with radius s
function bloom(s, { mono = false } = {}) {
  const outer = s, inner = s*0.67;
  const P = mono ? ['#fff','#fff','#fff'] : ['#E8A3B9','#D992AA','#F6CAD7'];
  let g = '';
  for (let i=0;i<8;i++) g += `<path d="${petal(outer, outer*0.42)}" transform="rotate(${i*45})" fill="${P[i%2]}" ${mono?'':'opacity="0.93"'}/>`;
  if (!mono) for (let i=0;i<8;i++) g += `<path d="${petal(inner, inner*0.45)}" transform="rotate(${i*45+22.5})" fill="${P[2]}" opacity="0.96"/>`;
  if (mono) return `<mask id="hole"><rect x="-512" y="-512" width="1024" height="1024" fill="#fff"/><circle r="${s*0.2}" fill="#000"/></mask><g mask="url(#hole)">${g}</g><circle r="${s*0.12}" fill="#fff"/>`;
  return g + `<circle r="${s*0.24}" fill="url(#core)"/>`;
}
function ring(r, sw) {
  const seg = [[0.03,0.2,'#D992AA'],[0.24,0.45,'#F9C8B0'],[0.49,0.6,'#B8A3E6'],[0.64,0.97,'#C9A4C8']];
  return seg.map(([a,b,c]) => `<path d="${arc(r, a*2*Math.PI, b*2*Math.PI)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`).join('')
    + `<circle cx="${(r*Math.sin(0.11*2*Math.PI)).toFixed(2)}" cy="${(-r*Math.cos(0.11*2*Math.PI)).toFixed(2)}" r="${sw*1.25}" fill="#49364B"/><circle cx="${(r*Math.sin(0.11*2*Math.PI)).toFixed(2)}" cy="${(-r*Math.cos(0.11*2*Math.PI)).toFixed(2)}" r="${sw*0.5}" fill="#FFF9F5"/>`;
}
const defs = `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4F1"/><stop offset="0.55" stop-color="#F7DCE5"/><stop offset="1" stop-color="#E9E1F8"/></linearGradient>
<radialGradient id="core" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#FFF9F5"/><stop offset="1" stop-color="#9A5D78"/></radialGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
</defs>`;
const svg = (body, bg = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${bg}<g transform="translate(512 512)">${body}</g></svg>`;
const files = {
  // full icon (iOS / legacy): gradient square, ring + bloom
  'icon': svg(`<circle r="420" fill="url(#glow)"/>${ring(360, 30)}${bloom(270)}`, `<rect width="1024" height="1024" fill="url(#bg)"/>`),
  // adaptive: foreground must sit in the inner 66% safe zone (≈ r 338)
  'android-icon-foreground': svg(`${ring(300, 26)}${bloom(225)}`),
  'android-icon-background': svg('', `<rect width="1024" height="1024" fill="url(#bg)"/><circle cx="512" cy="512" r="420" fill="url(#glow)"/>`),
  'android-icon-monochrome': svg(`<circle r="300" stroke="#fff" stroke-width="26" fill="none" stroke-dasharray="330 40"/>${bloom(225, { mono: true })}`),
  'splash-icon': svg(`${ring(440, 34)}${bloom(330)}`),
};
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [name, s] of Object.entries(files)) {
  fs.writeFileSync(`${OUT}/brand/${name}.svg`, s);
  await page.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await page.locator('svg').screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
}
await page.setViewportSize({ width: 48, height: 48 });
await page.setContent(`<html><body style="margin:0">${files.icon.replace('width="1024" height="1024"','width="48" height="48"')}</body></html>`);
await page.locator('svg').screenshot({ path: `${OUT}/favicon.png`, omitBackground: true });
await browser.close();
console.log('ok');
