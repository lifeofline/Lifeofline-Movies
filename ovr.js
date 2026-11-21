// Renders Urdu (Nastaliq) caption images: node ovr.js jobs.json outdir. Each job {name, text, size, color, shadow, maxw}
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [jobsFile, out] = process.argv.slice(2); const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const font = 'data:font/woff2;base64,' + fs.readFileSync(path.join(__dirname, 'nastaliq.woff2')).toString('base64');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const j of jobs) {
    const W = j.maxw + 40, H = j.size * 4; await p.setViewportSize({ width: W, height: H });
    let size = j.size;
    for (;;) {
      await p.setContent(`<style>@font-face{font-family:N;src:url(${font})}html,body{margin:0;background:transparent}
      #b{width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center}
      #t{font-family:N;font-size:${size}px;line-height:1;color:${j.color || '#fff'};text-shadow:${j.shadow || '0 2px 8px rgba(0,0,0,.85)'};white-space:nowrap;direction:rtl;padding:0 8px}</style>
      <div id=b><span id=t></span></div>`);
      await p.evaluate((t) => { document.getElementById('t').textContent = t; }, j.text);
      await p.evaluate(() => document.fonts.ready);
      const w = await p.evaluate(() => document.getElementById('t').getBoundingClientRect().width);
      if (w <= j.maxw || size < 12) break; size -= 2;
    }
    await p.screenshot({ path: `${out}/${j.name}.png`, omitBackground: true });
  }
  await b.close();
})();
