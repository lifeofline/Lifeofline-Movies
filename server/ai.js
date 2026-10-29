// "Create with AI" for the admin page: short video clips (Gemini Omni Flash) and pictures (Nano Banana) through the
// Gemini API. Shared by Lifeofline Movies and ArtistCart (same file in both servers).
//
// Render settings:
//   GEMINI_API_KEY      the Gemini API key (Google AI Studio / Google Cloud). Without it the AI tab says it isn't set up.
//   AI_DAILY_USD        optional spending cap per day in US dollars (default 5). Checked before every request.
//   GEMINI_VIDEO_MODEL  optional, default gemini-omni-1.1-flash
//   GEMINI_IMAGE_MODEL  optional, default gemini-nano-banana-2.1
//
// Only admins reach this (the caller checks). Nothing is published here: the admin page previews the result and the
// admin decides where it goes (trailer, poster, banner).
const BASE = "https://generativelanguage.googleapis.com/v1beta";

module.exports = function makeAI({ db, env }) {
  const clean = (v) => String(v || "").trim().replace(/^["']|["']$/g, "");
  const KEY = clean(env.GEMINI_API_KEY);
  const VIDEO_MODEL = clean(env.GEMINI_VIDEO_MODEL) || "gemini-omni-1.1-flash";
  const IMAGE_MODEL = clean(env.GEMINI_IMAGE_MODEL) || "gemini-nano-banana-2.1";
  const CAP = Math.max(0.5, Number(clean(env.AI_DAILY_USD)) || 5);
  const LIVE = !!KEY;
  const show = (msg, status = 400) => Object.assign(new Error(msg), { show: true, status });

  // Rough Google list prices, used only for the daily cap and the admin's running total.
  const VIDEO_USD_PER_SEC = { "360p": 0.034, "720p": 0.101, "1080p": 0.152, "4k": 0.304 };
  const IMAGE_USD = 0.1;
  const CLIP_SECONDS = 10; // a clip is up to 10 seconds; budget for the longest

  const day = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10); // India date
  const spendRef = () => db.doc(`server/aiSpend-${day()}`);

  async function spentToday() { const d = (await spendRef().get()).data(); return { usd: +(d?.usd || 0), count: d?.count || 0 }; }
  // Reserves the estimated cost before calling Google, so two admins can't overshoot the cap together.
  async function reserve(usd) {
    await db.runTransaction(async (tx) => {
      const ref = spendRef(); const cur = (await tx.get(ref)).data() || {};
      const used = +(cur.usd || 0);
      if (used + usd > CAP) throw show(`Today's AI limit is $${CAP.toFixed(2)} and $${used.toFixed(2)} is used. Try tomorrow, or raise AI_DAILY_USD on Render.`);
      tx.set(ref, { usd: +(used + usd).toFixed(4), count: (cur.count || 0) + 1, day: day() }, { merge: true });
    });
  }
  async function refund(usd) { // a request Google rejected outright isn't billed
    await db.runTransaction(async (tx) => { const ref = spendRef(); const cur = (await tx.get(ref)).data() || {}; tx.set(ref, { usd: Math.max(0, +((+(cur.usd || 0)) - usd).toFixed(4)) }, { merge: true }); }).catch(() => {});
  }

  // Turns Google's answer into something an admin can act on.
  function why(status, text) {
    let msg = ""; try { const j = JSON.parse(text); msg = j.error?.message || ""; } catch { msg = String(text || "").slice(0, 200); }
    const hint = status === 401 || status === 403 || /api key|permission|unauth/i.test(msg) ? " Check GEMINI_API_KEY on Render, and that the Gemini API is enabled for that key."
      : status === 429 || /quota|rate|billing|resource.?exhausted/i.test(msg) ? " Google's limit was reached, or billing isn't set up for this key. Check billing in Google AI Studio and try again later."
      : status === 404 || /not found|model/i.test(msg) ? " This AI model isn't available to this key. Set GEMINI_VIDEO_MODEL or GEMINI_IMAGE_MODEL on Render to a model your key can use."
      : /safety|policy|block/i.test(msg) ? " Google blocked this request under its content rules. Change the description and try again."
      : "";
    return show(`Google refused the request (${status}${msg ? ": " + msg.slice(0, 300) : ""}).${hint}`);
  }
  async function g(path, { method = "POST", body, raw = false, timeout = 290000 } = {}) {
    let res;
    try { res = await fetch(BASE + path, { method, headers: { "x-goog-api-key": KEY, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) }); }
    catch (e) { throw show(e.name === "TimeoutError" ? "Google took too long to answer. Try again; shorter or simpler descriptions are quicker." : "Couldn't reach Google: " + (e.cause?.message || e.message)); }
    if (raw) { if (!res.ok) throw why(res.status, await res.text().catch(() => "")); return Buffer.from(await res.arrayBuffer()); }
    const text = await res.text();
    if (!res.ok) { console.error("Gemini", method, path.split("?")[0], res.status, text.slice(0, 500)); throw why(res.status, text); }
    try { return JSON.parse(text); } catch { throw show("Google sent an answer we couldn't read. Try again."); }
  }

  const ASPECTS_IMG = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
  const cleanPrompt = (p) => { const s = String(p || "").replace(/\s+/g, " ").trim().slice(0, 2000); if (s.length < 8) throw show("Describe what you want in a sentence or two."); return s; };
  // A picture passed in from the admin page: "data:image/png;base64,...."
  function picture(dataUrl) {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
    if (!m) throw show("That picture couldn't be read. Use a PNG, JPG or WebP.");
    if (m[2].length > 9e6) throw show("That picture is too big. Use one under 6 MB.");
    return { mime: m[1], data: m[2] };
  }

  // Picture: banner, poster or thumbnail. Returns { mime, data (base64), text }.
  async function image({ prompt, aspect = "16:9", size = "2K", ref }, by = "") {
    if (!LIVE) throw show("AI isn't set up yet. Add GEMINI_API_KEY on Render.");
    const text = cleanPrompt(prompt);
    if (!ASPECTS_IMG.includes(aspect)) aspect = "16:9";
    if (!["1K", "2K", "4K"].includes(size)) size = "2K";
    const parts = [{ text }]; if (ref) { const p = picture(ref); parts.unshift({ inlineData: { mimeType: p.mime, data: p.data } }); }
    await reserve(IMAGE_USD);
    let r;
    try { r = await g(`/models/${encodeURIComponent(IMAGE_MODEL)}:generateContent`, { body: { contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: aspect, imageSize: size } } }, timeout: 180000 }); }
    catch (e) { await refund(IMAGE_USD); throw e; }
    const out = (r.candidates?.[0]?.content?.parts || []);
    const img = out.find((p) => p.inlineData?.data || p.inline_data?.data);
    if (!img) {
      const why2 = r.promptFeedback?.blockReason || r.candidates?.[0]?.finishReason || "";
      throw show(`No picture came back${why2 ? " (" + why2 + ")" : ""}. ${out.map((p) => p.text).filter(Boolean).join(" ").slice(0, 300) || "Try describing it differently."}`);
    }
    const d = img.inlineData || img.inline_data;
    await log("image", text, IMAGE_MODEL, IMAGE_USD, { aspect, size, by });
    return { mime: d.mimeType || d.mime_type || "image/png", data: d.data, text: out.map((p) => p.text).filter(Boolean).join(" ").slice(0, 500), model: IMAGE_MODEL };
  }

  // Finds the first video item anywhere in Google's answer (it sits under steps → model_output → content).
  function findVideo(o, depth = 0) {
    if (!o || typeof o !== "object" || depth > 12) return null;
    if ((o.type === "video" || /^video\//.test(o.mime_type || o.mimeType || "")) && (o.data || o.uri)) return o;
    for (const v of Array.isArray(o) ? o : Object.values(o)) { const f = findVideo(v, depth + 1); if (f) return f; }
    return null;
  }

  // Video clip, up to about 10 seconds, with sound. Returns { mime, data (base64) }.
  async function video({ prompt, aspect = "16:9", resolution = "720p", ref }, by = "") {
    if (!LIVE) throw show("AI isn't set up yet. Add GEMINI_API_KEY on Render.");
    const text = cleanPrompt(prompt);
    if (!["16:9", "9:16"].includes(aspect)) aspect = "16:9";
    if (!VIDEO_USD_PER_SEC[resolution]) resolution = "720p";
    const usd = +(VIDEO_USD_PER_SEC[resolution] * CLIP_SECONDS).toFixed(3);
    const input = ref ? (() => { const p = picture(ref); return [{ type: "image", data: p.data, mime_type: p.mime }, { type: "text", text }]; })() : text;
    await reserve(usd);
    let r;
    try { r = await g("/interactions", { body: { model: VIDEO_MODEL, input, response_format: { type: "video", aspect_ratio: aspect, resolution, delivery: "uri" } } }); }
    catch (e) { await refund(usd); throw e; }
    const v = findVideo(r);
    if (!v) { console.error("Gemini video: no video in answer", JSON.stringify(r).slice(0, 800)); throw show("No video came back. Google may have blocked the description; try wording it differently."); }
    let data = v.data;
    if (!data) { // large clips come back as a file to download
      const id = (/files\/([^/:?]+)/.exec(v.uri) || [])[1];
      if (!id) throw show("Google returned a video link we couldn't read. Try again.");
      for (let i = 0; i < 40; i++) { // wait for the file to be ready (up to ~2 minutes)
        const f = await g(`/files/${id}`, { method: "GET", timeout: 30000 });
        if (f.state === "ACTIVE" || !f.state) break;
        if (f.state === "FAILED") throw show("Google couldn't finish the video. Try again.");
        await new Promise((ok) => setTimeout(ok, 3000));
      }
      data = (await g(`/files/${id}:download?alt=media`, { method: "GET", raw: true, timeout: 120000 })).toString("base64");
    }
    await log("video", text, VIDEO_MODEL, usd, { aspect, resolution, image: !!ref, by });
    return { mime: v.mime_type || v.mimeType || "video/mp4", data, model: VIDEO_MODEL };
  }

  async function log(kind, prompt, model, usd, extra) {
    await db.collection("aiLog").add({ kind, prompt: prompt.slice(0, 500), model, usd, ...extra, at: Date.now() }).catch(() => {});
  }
  async function status() {
    const s = await spentToday();
    const recent = await db.collection("aiLog").orderBy("at", "desc").limit(8).get().then((q) => q.docs.map((d) => d.data())).catch(() => []);
    return { live: LIVE, cap: CAP, usedToday: +s.usd.toFixed(2), countToday: s.count, videoModel: VIDEO_MODEL, imageModel: IMAGE_MODEL, prices: { videoPerSecond: VIDEO_USD_PER_SEC, image: IMAGE_USD, clipSeconds: CLIP_SECONDS }, recent };
  }

  // One entry point for the admin route: { action: "aiStatus" | "aiImage" | "aiVideo", ... }
  async function handle(by, b) {
    if (b.action === "aiStatus") return status();
    if (b.action === "aiImage") return image(b, by);
    if (b.action === "aiVideo") return video(b, by);
    throw show("bad request");
  }
  return { LIVE, handle, actions: ["aiStatus", "aiImage", "aiVideo"] };
};
