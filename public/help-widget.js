// Lifeofline chat support: instant bot answers, then the Lifeofline Helpdesk by live chat, call, WhatsApp,
// SMS or email. Shared by ArtistCart and Lifeofline Movies; each app passes its own answers and live-chat hooks.
//
// createHelp({
//   brand: "ArtistCart", accent: "#e9a21a", accentInk: "#2a1d00", ink: "#171a33",
//   faqs: [{ id, q, keys: /regex/, a: "html", links: [[label, href]], next: [faq ids] }],
//   starters: [faq ids], hours: { from: 9, to: 21 },   // 9 AM – 9 PM IST, every day
//   contact: () => ({ phone, whatsapp, email }),         // phone/whatsapp may be empty
//   user: () => ({ uid, name, email } | null),
//   live: { watch(cb) -> unsub, send(text, transcript) -> Promise, seen() } | null,
//   signIn: () => void, bottom: () => px offset for the button, hidden: () => bool,
// })
const lhCss = (a, ai, ink, T) => `
#lh-fab{position:fixed;right:14px;z-index:60;width:56px;height:56px;border-radius:50%;border:0;background:${ink};color:#fff;box-shadow:0 6px 20px rgb(0 0 0/.28);display:grid;place-items:center;cursor:pointer;font-size:24px;transition:transform .15s}
#lh-fab:active{transform:scale(.94)}
#lh-fab .dot{position:absolute;top:4px;right:4px;min-width:18px;height:18px;border-radius:9px;background:${a};color:${ai};font:700 11px system-ui;display:grid;place-items:center;padding:0 4px}
#lh-fab[hidden]{display:none}
#lh-panel{position:fixed;inset:0;z-index:2000;display:flex;align-items:flex-end;justify-content:flex-end;background:rgb(0 0 0/.35)}
#lh-panel[hidden]{display:none}
.lh-box{width:100%;max-width:420px;height:min(92vh,720px);background:${T.surface};color:${T.text};border-radius:18px 18px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 40px rgb(0 0 0/.25)}
@media (min-width:600px){#lh-panel{align-items:flex-end;padding:16px}.lh-box{border-radius:18px;height:min(80vh,680px)}}
.lh-head{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:12px 14px;background:${ink};color:#fff}
.lh-av{width:38px;height:38px;border-radius:50%;background:${a};color:${ai};display:grid;place-items:center;font-size:20px}
.lh-head b{display:block;font-size:15px}.lh-head small{font-size:12px;opacity:.85;display:flex;align-items:center;gap:5px}
.lh-on{width:8px;height:8px;border-radius:50%;background:#34d399;display:inline-block}.lh-off{background:#fbbf24}
.lh-x{background:rgb(255 255 255/.15);color:#fff;border:0;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer}
.lh-msgs{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px;display:flex;flex-direction:column;gap:8px;background:${T.bg}}
.lh-m{max-width:86%;padding:9px 12px;border-radius:14px;font-size:14.5px;line-height:1.45;overflow-wrap:anywhere}
.lh-m.bot,.lh-m.team{align-self:flex-start;background:${T.surface};border:1px solid ${T.line};border-bottom-left-radius:4px}
.lh-m.team{border-color:${a};box-shadow:inset 3px 0 0 ${a}}
.lh-m.me{align-self:flex-end;background:${ink};color:#fff;border-bottom-right-radius:4px}
.lh-m.sys{align-self:center;background:none;color:${T.muted};font-size:12.5px;text-align:center}
.lh-m .who{display:block;font-size:11px;font-weight:700;opacity:.7;margin-bottom:2px;text-transform:uppercase;letter-spacing:.04em}
.lh-m a{color:inherit;font-weight:700}
.lh-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.lh-links a,.lh-links button{font:600 13px system-ui;background:${a};color:${ai};border:0;border-radius:999px;padding:6px 11px;text-decoration:none;cursor:pointer}
.lh-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 14px 0;background:${T.bg}}
.lh-chips button{font:600 13px system-ui;background:${T.surface};color:${T.text};border:1px solid ${T.line};border-radius:999px;padding:7px 11px;cursor:pointer}
.lh-chips button.hd{border-color:${a};background:color-mix(in srgb,${a} 18%,${T.surface})}
.lh-contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:6px;padding:8px 14px;border-top:1px solid ${T.line};background:${T.surface}}
.lh-contact a,.lh-contact button{display:grid;justify-items:center;gap:2px;font:600 12px system-ui;color:${T.text};text-decoration:none;background:${T.bg};border:1px solid ${T.line};border-radius:10px;padding:7px 4px;cursor:pointer}
.lh-contact span{font-size:18px}
.lh-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px 14px 14px;background:${T.surface}}
.lh-form input{font:15px system-ui;border:1px solid ${T.line};border-radius:999px;padding:11px 14px;background:${T.bg};color:inherit;min-width:0}
.lh-form button{border:0;border-radius:999px;background:${a};color:${ai};font:700 14px system-ui;padding:0 16px;cursor:pointer}
.lh-mode{font:600 12px system-ui;padding:6px 14px;background:color-mix(in srgb,${a} 20%,${T.surface});display:flex;justify-content:space-between;gap:8px;align-items:center}
.lh-mode button{font:600 12px system-ui;background:none;border:0;text-decoration:underline;color:inherit;cursor:pointer}
`;
const lhEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const lhIstHour = () => new Date(Date.now() + 5.5 * 36e5).getUTCHours();

export function createHelp(o) {
  const hours = o.hours || { from: 9, to: 21 };
  const isOpen = () => { const h = lhIstHour(); return h >= hours.from && h < hours.to; };
  const hrs = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
  const style = document.createElement("style"); style.textContent = lhCss(o.accent, o.accentInk, o.ink, { surface: "var(--surface,#fff)", text: "var(--ink,#171a33)", bg: "var(--bg,#f4f4f7)", line: "var(--line,#ddd)", muted: "var(--muted,#666)", ...(o.theme || {}) }); document.head.appendChild(style);
  const fab = document.createElement("button"); fab.id = "lh-fab"; fab.type = "button"; fab.setAttribute("aria-label", "Help and support chat"); fab.innerHTML = `💬<span class="dot" hidden></span>`;
  const panel = document.createElement("div"); panel.id = "lh-panel"; panel.hidden = true;
  document.body.append(fab, panel);
  let log = []; let mode = "bot"; let liveStop = null; let liveMsgs = []; let unread = 0;
  try { log = JSON.parse(sessionStorage.getItem("lh-log") || "[]"); } catch { /* private mode */ }
  const save = () => { try { sessionStorage.setItem("lh-log", JSON.stringify(log.slice(-60))); } catch { /* ignore */ } };
  const faq = (id) => o.faqs.find((f) => f.id === id);

  function placeFab() { fab.style.bottom = (o.bottom?.() ?? 16) + "px"; fab.hidden = !!o.hidden?.() || !panel.hidden; }
  setInterval(placeFab, 800); window.addEventListener("hashchange", () => setTimeout(placeFab, 50)); placeFab();

  const transcript = () => log.filter((m) => m.from !== "sys").slice(-12).map((m) => `${m.from === "me" ? "Me" : o.brand + " helper"}: ${m.text.replace(/<[^>]+>/g, "")}`).join("\n");
  function contactHtml() {
    const c = o.contact() || {}; const tel = String(c.phone || "").replace(/[^\d+]/g, ""); const wa = String(c.whatsapp || c.phone || "").replace(/\D/g, "");
    const wa91 = wa.length === 10 ? "91" + wa : wa; const msg = encodeURIComponent(`Hi Lifeofline Helpdesk, I need help with ${o.brand}.\n\n` + transcript().slice(-900));
    const mail = c.email ? `mailto:${c.email}?subject=${encodeURIComponent(o.brand + " help request")}&body=${msg}` : "";
    return `<div class="lh-contact">
      <button type="button" data-lh="live"><span>👩‍💼</span>Chat with us</button>
      ${tel ? `<a href="tel:${lhEsc(tel)}"><span>📞</span>Call</a>` : ""}
      ${wa ? `<a href="https://wa.me/${lhEsc(wa91)}?text=${msg}" target="_blank" rel="noopener"><span>🟢</span>WhatsApp</a>` : ""}
      ${tel ? `<a href="sms:${lhEsc(tel)}?body=${msg}"><span>📱</span>SMS</a>` : ""}
      ${mail ? `<a href="${lhEsc(mail)}"><span>✉️</span>Email</a>` : ""}
    </div>`;
  }
  function msgHtml(m) {
    const who = m.from === "team" ? `<span class="who">Lifeofline Helpdesk${m.name ? " · " + lhEsc(m.name) : ""}</span>` : m.from === "bot" ? `<span class="who">${lhEsc(o.brand)} helper</span>` : "";
    return `<div class="lh-m ${m.from}">${who}${m.html ? m.text : lhEsc(m.text)}${m.links?.length ? `<div class="lh-links">${m.links.map(([l, h]) => h.startsWith("#lh:") ? `<button type="button" data-lh="${lhEsc(h.slice(4))}">${lhEsc(l)}</button>` : `<a href="${lhEsc(h)}" ${/^https?:/.test(h) ? 'target="_blank" rel="noopener"' : ""}>${lhEsc(l)}</a>`).join("")}</div>` : ""}</div>`;
  }
  function render() {
    const open = isOpen();
    const chips = mode === "bot" ? (log.length && log[log.length - 1].next ? log[log.length - 1].next : o.starters) : [];
    panel.innerHTML = `<div class="lh-box" role="dialog" aria-label="${lhEsc(o.brand)} help">
      <div class="lh-head"><span class="lh-av">🤝</span><div><b>${lhEsc(o.brand)} Help</b><small><span class="lh-on ${open ? "" : "lh-off"}"></span>${open ? "Lifeofline Helpdesk is online now" : `Helpdesk back at ${hrs(hours.from)} · the helper answers 24×7`}</small></div><button type="button" class="lh-x" data-lh="close" aria-label="Close">✕</button></div>
      ${mode === "live" ? `<div class="lh-mode"><span>👩‍💼 You're chatting with the Lifeofline Helpdesk</span><button type="button" data-lh="bot">Back to quick answers</button></div>` : ""}
      <div class="lh-msgs" id="lh-msgs">${(mode === "live" ? liveMsgs : log).map(msgHtml).join("")}</div>
      ${chips.length ? `<div class="lh-chips">${chips.map((id) => faq(id)).filter(Boolean).map((f) => `<button type="button" data-q="${lhEsc(f.id)}">${lhEsc(f.q)}</button>`).join("")}<button type="button" class="hd" data-lh="live">👩‍💼 Talk to a person</button></div>` : ""}
      <form class="lh-form" id="lh-form"><input id="lh-in" autocomplete="off" maxlength="1000" placeholder="${mode === "live" ? "Write to the Helpdesk…" : "Type your question…"}" aria-label="Your message"><button type="submit">Send</button></form>
      ${contactHtml()}</div>`;
    const box = panel.querySelector("#lh-msgs"); box.scrollTop = box.scrollHeight;
  }
  function botSay(f) { log.push({ from: "bot", html: true, text: f.a, links: f.links || [], next: f.next || null }); save(); render(); }
  function answer(text) {
    const t = text.toLowerCase();
    let best = null, top = 0;
    // Score each answer by how many of its keywords appear in the question; the best one wins.
    for (const f of o.faqs) { const sc = (t.match(new RegExp(f.keys.source, "gi")) || []).length; if (sc > top) { top = sc; best = f; } }
    if (best) return botSay(best);
    log.push({ from: "bot", html: true, text: `I don't have a ready answer for that. The Lifeofline Helpdesk can help${isOpen() ? ", and they're online now" : `. They're online ${hrs(hours.from)}–${hrs(hours.to)} every day, and will reply as soon as they're back`}.`, links: [["👩‍💼 Chat with the Helpdesk", "#lh:live"]], next: o.starters });
    save(); render();
  }
  function greet() {
    if (log.length) return;
    const u = o.user();
    log.push({ from: "bot", html: true, text: `Hi${u?.name ? " " + lhEsc(u.name.split(" ")[0]) : ""}! 👋 I'm the ${lhEsc(o.brand)} helper. Pick a topic or type your question. For anything else, the Lifeofline Helpdesk is one tap away.`, next: o.starters });
    save();
  }
  async function goLive() {
    if (!o.live) return;
    if (!o.user()) { log.push({ from: "bot", html: true, text: "To chat with the Helpdesk in the app, please sign in first (so we can reply to you here). You can also reach us right now by WhatsApp, call or email below.", links: [["Sign in", "#lh:signin"]] }); save(); render(); return; }
    mode = "live"; render();
    let seenCount = -1;
    liveStop?.(); liveStop = o.live.watch((list) => {
      liveMsgs = [{ from: "sys", text: isOpen() ? "Tell us what you need. A Helpdesk member usually replies within a few minutes." : `The Helpdesk is offline now (${hrs(hours.from)}–${hrs(hours.to)} every day). Leave your message and we'll reply here and by email first thing.` }, ...list];
      if (mode === "live" && !panel.hidden) {
        const inp = panel.querySelector("#lh-in"); const val = inp?.value || "", focused = document.activeElement === inp; render();
        const i2 = panel.querySelector("#lh-in"); if (i2) { i2.value = val; if (focused) i2.focus(); }
        if (list.length !== seenCount) { seenCount = list.length; o.live.seen?.(); } // only when something new arrived
      }
    });
  }
  panel.addEventListener("click", (e) => {
    if (e.target === panel) return close();
    const q = e.target.closest("[data-q]"); if (q) { const f = faq(q.dataset.q); log.push({ from: "me", text: f.q }); return botSay(f); }
    const b = e.target.closest("[data-lh]"); if (!b) return; const a = b.dataset.lh;
    if (a === "close") return close();
    if (a === "live") return goLive();
    if (a === "bot") { mode = "bot"; return render(); }
    if (a === "signin") { close(); o.signIn?.(); }
    if (a.startsWith("go:")) { close(); location.hash = a.slice(3); }
  });
  panel.addEventListener("submit", async (e) => {
    e.preventDefault(); const inp = panel.querySelector("#lh-in"); const text = inp.value.trim(); if (!text) return; inp.value = "";
    if (mode === "live") {
      const btn = panel.querySelector(".lh-form button"); btn.disabled = true;
      try { await o.live.send(text, transcript()); } catch (x) { alertMsg(x.message || "Couldn't send. Check your connection."); }
      btn.disabled = false; return;
    }
    log.push({ from: "me", text }); save(); answer(text);
  });
  const alertMsg = (t) => { liveMsgs.push({ from: "sys", text: t }); render(); };
  function open(topic) { greet(); if (topic && faq(topic)) { log.push({ from: "me", text: faq(topic).q }); botSay(faq(topic)); } panel.hidden = false; render(); placeFab(); if (mode === "live") o.live?.seen?.(); setTimeout(() => panel.querySelector("#lh-in")?.focus(), 50); }
  function close() { panel.hidden = true; placeFab(); }
  fab.addEventListener("click", () => open());
  return {
    open, close, goLive: () => { open(); goLive(); },
    setUnread(n) { unread = n; const d = fab.querySelector(".dot"); d.hidden = !n; d.textContent = n > 9 ? "9+" : n; },
    refresh() { if (!panel.hidden) render(); placeFab(); },
    reset() { log = []; liveMsgs = []; mode = "bot"; liveStop?.(); liveStop = null; save(); },
  };
}
