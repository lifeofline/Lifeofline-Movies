// "Get the app": install Lifeofline Movies on a phone or computer, same as ArtistCart.
// Android/desktop Chrome and Edge give a one-tap prompt; iPhone needs Share → Add to Home Screen;
// WhatsApp/Instagram's built-in browsers can't install at all, so we send people to Chrome/Safari first.
import { $, esc, toast, isTV } from "./util.js";

const APP_LINK = "https://movies.lifeofline.com/";
const NAME = "Lifeofline Movies";
const INVITE_LINK = APP_LINK + "?install=1";
const INVITE_TEXT = `Watch Ghalib Zinda Hai and more on ${NAME} 🎬 Tap to add the app to your phone (free, no app store): ${INVITE_LINK}&src=wa`;

let installEvt = window.__bip || null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; document.dispatchEvent(new Event("lm-install")); });
window.addEventListener("appinstalled", () => { installEvt = null; toast(`${NAME} is installed. Open it from your home screen.`, 4000); document.dispatchEvent(new Event("lm-install")); });

// Inside the Google Play app (Android, opened with ?src=twa) or a future App Store app (?src=ios / Capacitor).
// Store rules: Premium can't be sold there with Razorpay, so the store apps don't sell it.
export const STORE_APP = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (window.Capacitor?.isNativePlatform?.() || q.get("src") === "ios") sessionStorage.setItem("lm-store", "ios");
    else if (q.get("src") === "twa" || document.referrer.startsWith("android-app://")) sessionStorage.setItem("lm-store", "android");
    return sessionStorage.getItem("lm-store") || "";
  } catch { return ""; }
})();
export const isStandalone = () => !!STORE_APP || window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isIPad = () => /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const iosMajor = () => { const m = navigator.userAgent.match(/Version\/(\d+)/) || navigator.userAgent.match(/OS (\d+)_/); return m ? +m[1] : 0; };

// Which browser is this? Install works differently in each.
function browserKind() {
  const ua = navigator.userAgent;
  const inApp = /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|Twitter|LinkedInApp/i.test(ua) || (/Android/.test(ua) && /; wv\)/.test(ua));
  if (inApp) return isIOS() ? "inapp-ios" : "inapp-android";
  if (isIOS()) return /CriOS|FxiOS|EdgiOS/.test(ua) ? "ios-other" : "ios-safari";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Android/.test(ua)) return "android";
  if (/Edg\//.test(ua)) return "desk-edge";
  if (/Firefox\//.test(ua)) return "desk-firefox";
  if (/Safari\//.test(ua) && !/Chrome|Chromium/.test(ua)) return "desk-safari";
  return "desktop";
}

const IOS_MORE = `<span class="ios-key" aria-label="More button">•••</span>`;
const IOS_SHARE = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/></svg>`;

// A small phone drawn the way that browser looks, with the button to tap ringed in gold.
const PIC = (() => {
  const O = "#f4ad3d", INK = "#140f1c", MUT = "#c9c2d4", HOST = "movies.lifeofline.com";
  const ring = (x, y, r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${O}" fill-opacity=".25" stroke="${O}" stroke-width="3"><animate attributeName="r" values="${r};${r + 3};${r}" dur="1.4s" repeatCount="indefinite"/></circle><text x="${x + 4}" y="${y + 22}" font-size="16">👆</text>`;
  const shareIc = (x, y, c = INK) => `<g transform="translate(${x - 6} ${y - 7})" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 1v8M3 4l3-3 3 3"/><path d="M2 7v6h8V7"/></g>`;
  const page = (top = 40) => `<rect x="14" y="${top}" width="92" height="44" rx="6" fill="#2a2237"/><image href="icon-192.png" x="49" y="${top + 10}" width="22" height="22"/><rect x="14" y="${top + 52}" width="28" height="40" rx="4" fill="#3a3049"/><rect x="46" y="${top + 52}" width="28" height="40" rx="4" fill="#3a3049"/><rect x="78" y="${top + 52}" width="28" height="40" rx="4" fill="#3a3049"/>`;
  const phone = (inner) => `<svg class="ga-pic" viewBox="0 0 120 200" aria-hidden="true" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"><rect x="2" y="2" width="116" height="196" rx="16" fill="#1d1727" stroke="${MUT}" stroke-width="3"/>${inner}</svg>`;
  const topBar = (icon) => `<rect x="8" y="12" width="104" height="20" rx="10" fill="#eef0f6"/><text x="14" y="25.5" font-size="6.6" fill="#555a70">${HOST}</text>${icon}`;
  const botBar = (icon) => `<rect x="4" y="160" width="112" height="34" fill="#f6f7fa"/><rect x="10" y="164" width="100" height="13" rx="6" fill="#e6e8f0"/><text x="22" y="173.5" font-size="6.4" fill="#555a70">${HOST}</text>${icon}`;
  const menu = (x, y, w, rows, hl) => `<rect x="${x}" y="${y}" width="${w}" height="${rows.length * 17 + 6}" rx="8" fill="#fff" stroke="${MUT}"/>${rows.map((r, i) => `<rect x="${x + 3}" y="${y + 3 + i * 17}" width="${w - 6}" height="16" rx="5" fill="${i === hl ? "#fff3d6" : "#fff"}" ${i === hl ? `stroke="${O}" stroke-width="2"` : ""}/><text x="${x + 9}" y="${y + 14 + i * 17}" font-size="${i === hl ? 7.6 : 7}" font-weight="${i === hl ? 800 : 400}" fill="${i === hl ? INK : "#666b80"}">${r}</text>`).join("")}`;
  const dialog = (title, btn, pos = "right") => `<rect x="4" y="4" width="112" height="192" rx="14" fill="#000" fill-opacity=".45"/><rect x="10" y="${pos === "right" ? 20 : 60}" width="100" height="${pos === "right" ? 74 : 80}" rx="10" fill="#fff"/>` +
    (pos === "right" ? `<text x="16" y="34" font-size="7" fill="#3478f6">Cancel</text><text x="38" y="34" font-size="6.6" font-weight="700" fill="${INK}">${title}</text><text x="92" y="34" font-size="8" font-weight="800" fill="#3478f6">${btn}</text><image href="icon-192.png" x="16" y="46" width="22" height="22"/><text x="44" y="60" font-size="7.4" font-weight="700" fill="${INK}">Lifeofline</text>${ring(97, 31, 10)}`
      : `<text x="18" y="78" font-size="8" font-weight="800" fill="${INK}">${title}</text><image href="icon-192.png" x="18" y="86" width="20" height="20"/><text x="44" y="99" font-size="7.4" fill="${INK}">Lifeofline</text><rect x="64" y="114" width="40" height="18" rx="9" fill="#1a73e8"/><text x="72" y="126" font-size="8" font-weight="800" fill="#fff">${btn}</text>${ring(84, 123, 13)}`);
  const home = () => `<rect x="4" y="4" width="112" height="192" rx="14" fill="#2b2f4a"/>${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (r === 1 && c === 2) ? "" : `<rect x="${14 + c * 25}" y="${24 + r * 32}" width="17" height="17" rx="5" fill="#ffffff" fill-opacity=".18"/>`).join("")).join("")}<image href="icon-192.png" x="62" y="54" width="20" height="20"/><text x="57" y="82" font-size="5.6" fill="#fff">Lifeofline</text>${ring(72, 64, 14)}`;
  const iosSheet = (hl = 2) => `<rect x="4" y="70" width="112" height="126" rx="12" fill="#f2f2f7"/>${menu(10, 92, 100, ["Copy", "Add to Reading List", "Add to Home Screen", "Add Bookmark"], hl)}<text x="12" y="84" font-size="6.6" font-weight="700" fill="${INK}">${HOST}</text>`;
  const dots = (x, y) => `<text x="${x}" y="${y}" font-size="13" font-weight="900" fill="${INK}">⋮</text>`;
  return {
    "ios-safari-old": [phone(page() + botBar(shareIc(60, 186) + ring(60, 186))), phone(page() + iosSheet()), phone(page() + dialog("Add to Home", "Add"))],
    "ios-safari-26": [phone(page() + botBar(`<text x="94" y="174" font-size="10" font-weight="900" fill="${INK}">•••</text>` + ring(100, 171))), phone(page() + menu(26, 92, 88, ["Copy", "Share", "Add Bookmark", "Find on Page"], 1)), phone(page() + iosSheet())],
    "ios-other": [phone(topBar(shareIc(102, 22) + ring(102, 22)) + page()), phone(page() + iosSheet()), phone(page() + dialog("Add to Home", "Add"))],
    android: [phone(topBar(dots(100, 27) + ring(102, 22)) + page()), phone(topBar("") + page() + menu(34, 30, 80, ["New tab", "Bookmarks", "Share…", "Install app", "Settings"], 3)), phone(page() + dialog("Install app?", "Install", "center"))],
    samsung: [phone(page() + botBar(`<text x="98" y="190" font-size="12" font-weight="900" fill="${INK}">≡</text>` + ring(101, 186))), phone(page() + menu(24, 90, 90, ["Bookmarks", "Add page to", "Share", "Settings"], 1)), phone(page() + dialog("Add to Home screen", "Add", "center"))],
    "inapp-android": [null, phone(topBar(dots(100, 27) + ring(102, 22)) + page() + menu(30, 36, 84, ["Copy link", "Open in Chrome", "Share"], 1)), null],
    "inapp-ios": [null, phone(topBar(`<text x="94" y="26" font-size="10" font-weight="900" fill="${INK}">•••</text>` + ring(100, 22)) + page() + menu(30, 36, 84, ["Copy link", "Open in Safari", "Share"], 1)), null],
    done: phone(home()),
  };
})();

function steps() {
  const k = browserKind();
  const S = {
    "inapp-android": [`You've opened this inside another app (like WhatsApp or Instagram), which can't install apps.`, `Tap <b>⋮</b> or <b>•••</b> at the top-right and choose <b>Open in Chrome</b> (or <b>Open in browser</b>).`, `In Chrome, tap <b>Install app</b>. If you don't see it, tap <b>⋮</b> → <b>Add to Home screen</b> → <b>Install</b>.`],
    "inapp-ios": [`You've opened this inside another app (like WhatsApp or Instagram), which can't install apps.`, `Tap <b>•••</b> and choose <b>Open in Safari</b>. If there's no such option, copy the link below and paste it into Safari.`, `In Safari, tap ${IOS_SHARE} <b>Share</b>, then <b>Add to Home Screen</b> → <b>Add</b>.`],
    "ios-safari": iosMajor() >= 26
      ? [`Tap ${IOS_MORE} next to the web address ${isIPad() ? "at the top" : "at the bottom of the screen"}.`, `Tap <span class="ios-key">${IOS_SHARE} Share</span>.`, `Scroll down, tap <b>Add to Home Screen</b>, then tap <b>Add</b>.`]
      : [`Tap <span class="ios-key">${IOS_SHARE}</span> <b>Share</b> ${isIPad() ? "at the top right" : "at the bottom of the screen"}.`, `Scroll down and tap <b>Add to Home Screen</b>.`, `Tap <b>Add</b>. The Lifeofline Movies icon appears on your home screen.`],
    "ios-other": [`Tap ${IOS_SHARE} <b>Share</b> (top-right in Chrome, or in the menu).`, `Tap <b>Add to Home Screen</b>. If it isn't there, open this page in <b>Safari</b> and do it there.`, `Tap <b>Add</b>.`],
    samsung: [`Tap <b>≡</b> (menu) at the bottom-right.`, `Tap <b>Add page to</b> → <b>Home screen</b>.`, `Tap <b>Add</b>.`],
    android: [`Tap <b>⋮</b> (three dots) at the top-right of Chrome.`, `Tap <b>Install app</b> or <b>Add to Home screen</b>.`, `Tap <b>Install</b>. Find Lifeofline Movies on your home screen.`],
    desktop: [`Click <b>⋮</b> at the top-right of Chrome (or the install icon <b>⊕</b> at the right end of the address bar).`, `Choose <b>Cast, save and share</b> → <b>Install page as app…</b> (older Chrome: <b>Install Lifeofline Movies…</b>).`, `Click <b>Install</b>. It opens in its own window and gets an icon on your desktop and taskbar.`],
    "desk-edge": [`Click <b>…</b> at the top-right of Edge.`, `Choose <b>Apps</b> → <b>Install this site as an app</b>.`, `Click <b>Install</b>. It opens in its own window, with an icon on your taskbar.`],
    "desk-safari": [`In the menu bar, click <b>File</b>.`, `Choose <b>Add to Dock…</b> (macOS Sonoma or newer).`, `Click <b>Add</b>. The app appears in your Dock.`],
    "desk-firefox": [`Firefox can't install web apps.`, `Open <b>movies.lifeofline.com</b> in <b>Chrome</b> or <b>Edge</b> and install it there.`, `Or scan the QR code below with your phone.`],
  }[k];
  const pk = k === "ios-safari" ? (iosMajor() >= 26 ? "ios-safari-26" : "ios-safari-old") : k, P = PIC[pk];
  if (!P) return `<ol class="ga-steps">${S.map((x) => `<li><span>${x}</span></li>`).join("")}</ol>`;
  return `<ol class="ga-steps pics">${S.map((x, i) => `<li><span>${x}</span>${P[i] || ""}</li>`).join("")}<li class="done-step"><span><b>Done!</b> Open Lifeofline Movies from your home screen, like any app. It opens full-screen and remembers where you stopped.</span>${PIC.done}</li></ol>`;
}

function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return (loadQr.p ||= new Promise((res, rej) => { const js = document.createElement("script"); js.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; js.onload = () => res(window.qrcode); js.onerror = () => { loadQr.p = null; rej(new Error("QR code couldn't load.")); }; document.head.append(js); }));
}

const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
// The bar waits until someone has seen the service: a second visit, opened a title, or played something.
export function markEngaged() { if (ls.get("lm-engaged") === "1") return; ls.set("lm-engaged", "1"); document.dispatchEvent(new Event("lm-install")); }
(() => { const n = +(ls.get("lm-visits") || 0) + 1; ls.set("lm-visits", String(n)); if (n >= 2) ls.set("lm-engaged", "1"); })();

// For the Account page: a button that installs or shows how.
export function installCard() {
  if (STORE_APP) return `<p class="small">You're using the ${STORE_APP === "ios" ? "App Store" : "Google Play"} app.</p>`;
  if (isStandalone()) return `<p class="small">You're using the installed app. ✓</p>`;
  return `<p class="small">Add Lifeofline Movies to your phone's home screen or your computer. It opens full-screen like any app, takes almost no space and needs no app store.</p>
    <div class="row"><button class="btn gold" data-ga="open" data-nav>${installEvt ? "⬇ Install the app" : "Show me how to install"}</button><button class="btn ghost" data-ga="wa" data-nav>Share on WhatsApp</button></div>`;
}

let sheet, bar;
export async function promptInstall() {
  if (!installEvt) return openSheet();
  const ev = installEvt; installEvt = null; ev.prompt();
  const r = await ev.userChoice.catch(() => ({}));
  if (r.outcome !== "accepted") installEvt = ev;
  drawBar();
}
function drawBar() {
  if (!bar) return;
  const snoozed = Date.now() < +(ls.get("lm-getapp-snooze") || 0);
  bar.hidden = isStandalone() || isTV() || snoozed || ls.get("lm-engaged") !== "1" || !!history.state?.player || location.hash.startsWith("#admin");
  bar.innerHTML = `<img src="icon-192.png" alt="" width="34" height="34"><div class="ga-txt"><b>Get the ${NAME} app</b><span>Free · opens from your home screen</span></div>
    <button type="button" class="btn gold sm" data-ga="open">${installEvt ? "Install" : "How?"}</button><button type="button" class="ga-x" data-ga="close" aria-label="Close">✕</button>`;
  document.body.classList.toggle("has-getapp", !bar.hidden);
  const slot = $("#install-slot"); if (slot) slot.innerHTML = installCard();
}
function openSheet() {
  const k = browserKind(), desk = k.startsWith("desk"), inapp = k.startsWith("inapp");
  const host = APP_LINK.replace("https://", "").replace(/\/$/, "");
  const openOut = k === "inapp-android" ? `<a class="btn gold wide" href="intent://${host}/?install=1&src=inapp#Intent;scheme=https;package=com.android.chrome;end">Open in Chrome to install</a>`
    : k === "inapp-ios" ? `<a class="btn gold wide" href="x-safari-https://${host}/?install=1&src=inapp">Open in Safari to install</a>` : "";
  sheet.innerHTML = `<div class="ga-card"><div class="ga-head"><img src="icon-192.png" alt="" width="48" height="48"><div><h2>${desk ? "Install on this computer" : "Add the app to your phone"}</h2><p class="small" style="margin:0">${desk ? "Opens in its own window, like any app." : "Takes 10 seconds. No app store needed."}</p></div></div>
    ${installEvt ? `<button type="button" class="btn gold wide ga-big" data-ga="prompt">⬇ Install ${NAME}</button><p class="small" style="text-align:center;margin:0">One tap. ${desk ? "It opens in its own window." : "It lands on your home screen."}</p>` : ""}
    ${openOut}${openOut ? `<p class="small" style="text-align:center;margin:0">WhatsApp and Instagram can't install apps, so open it in your browser first.</p>` : ""}
    ${installEvt ? `<details class="ga-more"><summary>Or do it yourself</summary>${steps()}</details>` : steps()}
    ${k === "ios-safari" ? `<button type="button" class="btn ghost wide" data-ga="point">Show me where to tap</button>` : ""}
    ${desk ? `<div class="ga-phone"><div class="ga-qr" id="ga-qr" aria-label="QR code to get the app on a phone"></div><div><b>Get it on your phone</b><span class="small">Point your phone camera at this code. It opens the app and shows how to add it to your home screen.</span></div></div>` : ""}
    <div class="ga-link"><code>${esc(host)}</code><button type="button" class="btn ghost sm" data-ga="copy">Copy link</button>${inapp ? "" : `<button type="button" class="btn ghost sm" data-ga="wa">WhatsApp</button>`}</div>
    <button type="button" class="btn ghost wide" data-ga="done">Close</button></div>`;
  sheet.hidden = false; ($("[data-ga=prompt]", sheet) || $("[data-ga=done]", sheet)).focus();
  if (desk) loadQr().then((qrcode) => { const q = qrcode(0, "M"); q.addData(INVITE_LINK + "&src=qr"); q.make(); const b = $("#ga-qr", sheet); if (b) b.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }).catch(() => { const b = $("#ga-qr", sheet); if (b) b.closest(".ga-phone").hidden = true; });
}
// iPhone: an arrow pointing at the Safari button to tap first (••• on iOS 26, Share on older versions).
function showPointer() {
  const v26 = iosMajor() >= 26, ipad = isIPad();
  const el = document.createElement("div"); el.className = `ga-point ${ipad ? "top" : "bottom"} ${v26 ? "right" : "center"}`;
  el.innerHTML = `<div class="ga-bubble">${v26 ? `Step 1: tap <b>•••</b> ${ipad ? "up here" : "down here"}<br><small>then <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b></small>` : `Step 1: tap <b>Share</b> ${ipad ? "up here" : "down here"}<br><small>then <b>Add to Home Screen</b> → <b>Add</b></small>`}</div><div class="ga-arrow" aria-hidden="true">${ipad ? "↑" : "↓"}</div>`;
  document.body.append(el);
  const off = () => { el.remove(); document.removeEventListener("click", off, true); };
  setTimeout(() => document.addEventListener("click", off, true), 300); setTimeout(off, 15000);
}

export function initInstall() {
  if (STORE_APP) document.body.classList.add("store-app");
  bar = document.createElement("div"); bar.id = "getapp-bar"; bar.hidden = true;
  sheet = document.createElement("div"); sheet.id = "getapp-sheet"; sheet.hidden = true; 
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Install the app");
  document.body.prepend(bar); document.body.append(sheet);
  document.addEventListener("click", async (e) => {
    const g = e.target.closest("[data-ga]"); if (!g) return;
    const a = g.dataset.ga;
    if (a === "open") { if (installEvt) return promptInstall(); openSheet(); }
    else if (a === "close") { ls.set("lm-getapp-snooze", String(Date.now() + 3 * 864e5)); drawBar(); }
    else if (a === "prompt") { sheet.hidden = true; promptInstall(); }
    else if (a === "done") sheet.hidden = true;
    else if (a === "point") { sheet.hidden = true; showPointer(); }
    else if (a === "copy") { try { await navigator.clipboard.writeText(INVITE_LINK); toast("Link copied. Paste it into Chrome or Safari."); } catch { toast(INVITE_LINK, 5000); } }
    else if (a === "wa") window.open("https://wa.me/?text=" + encodeURIComponent(INVITE_TEXT), "_blank", "noopener");
  });
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) sheet.hidden = true; });
  document.addEventListener("lm-install", drawBar);
  // Chrome's offer can arrive after the sheet opened: refresh it so the one-tap button shows.
  document.addEventListener("lm-install", () => { if (!sheet.hidden && installEvt && !$("[data-ga=prompt]", sheet)) openSheet(); });
  window.addEventListener("hashchange", () => setTimeout(drawBar, 50));
  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", drawBar);
  drawBar();
  // Opened from a QR code or an "install" link: show the steps straight away.
  const qs = new URLSearchParams(location.search);
  if (!isStandalone() && (qs.has("install") || qs.get("src") === "qr")) setTimeout(openSheet, 700);
  window.__promptInstall = promptInstall;
}
