// Live backend: Firebase Auth + Firestore for accounts and the catalogue, and the lifeofline-movies-api
// service on Render for playback links, payments and video uploads.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, sendPasswordResetEmail, sendEmailVerification, signOut, updateProfile,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, getDocs, serverTimestamp, onSnapshot, limit, writeBatch,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { loadScript } from "./util.js";

const ms = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0);
const norm = (snap) => { const d = snap.data() || {}; const o = { id: snap.id, ...d }; for (const k of ["createdAt", "updatedAt", "at", "lastAt"]) if (k in d) o[k] = ms(d[k]); return o; };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "title";
const friendly = (e) => {
  const c = e?.code || "";
  const m = {
    "auth/invalid-credential": "That email and password don't match.", "auth/wrong-password": "That email and password don't match.",
    "auth/user-not-found": "No account uses that email. Sign up instead.", "auth/email-already-in-use": "An account already uses that email. Sign in instead.",
    "auth/weak-password": "Use a password of at least 6 characters.", "auth/invalid-email": "Check the email address.",
    "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.", "auth/network-request-failed": "No connection. Check your internet and try again.",
    "auth/popup-closed-by-user": "Google sign-in was closed before it finished.", "permission-denied": "You don't have permission to do that.",
  };
  return Object.assign(new Error(m[c] || e?.message || "Something went wrong."), { code: c });
};

export function createFirebaseApi(config, appConfig = {}) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const base = String(appConfig.apiUrl || "").replace(/\/$/, "");
  const uid = () => auth.currentUser?.uid || null;
  let titleCache = null;

  // Wake the free Render service early so the first play isn't held up by its cold start.
  if (base) fetch(base + "/health").catch(() => {});

  async function call(path, body, { needAuth = true } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth.currentUser) headers.Authorization = "Bearer " + (await auth.currentUser.getIdToken());
    else if (needAuth) throw Object.assign(new Error("Sign in first."), { needSignIn: true });
    let res;
    try { res = await fetch(base + path, { method: "POST", headers, body: JSON.stringify(body || {}) }); }
    catch { throw new Error("Couldn't reach Lifeofline Movies. Check your connection and try again."); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong. Try again."), data, { status: res.status });
    return data.result;
  }
  const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw e.code ? friendly(e) : e; } };

  const api = {
    mode: "live",
    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, name: u.displayName || (u.email || "").split("@")[0], emailVerified: u.emailVerified } : null));
    },
    signUp: wrap(async (name, email, pass) => {
      const { user } = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, "users", user.uid), { name, createdAt: serverTimestamp() }, { merge: true });
      sendEmailVerification(user).catch(() => {});
      api.track("signup");
      return user;
    }),
    signIn: wrap((email, pass) => signInWithEmailAndPassword(auth, email, pass)),
    google: wrap(async () => {
      const p = new GoogleAuthProvider();
      let r;
      try { r = await signInWithPopup(auth, p); }
      catch (e) { if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") return signInWithRedirect(auth, p); throw e; }
      const ref = doc(db, "users", r.user.uid);
      if (!(await getDoc(ref)).exists()) { await setDoc(ref, { name: r.user.displayName || "Viewer", createdAt: serverTimestamp() }); api.track("signup"); }
      return r.user;
    }),
    resetPassword: wrap((email) => sendPasswordResetEmail(auth, email)),
    sendVerify: wrap(() => sendEmailVerification(auth.currentUser)),
    signOut: () => signOut(auth),
    me: () => auth.currentUser,

    // Catalogue (public). Sorted here so Firestore needs no extra index.
    async titles() {
      if (!titleCache || Date.now() - titleCache.at > 5 * 60e3) {
        const s = await getDocs(query(collection(db, "titles"), where("published", "==", true)));
        titleCache = { at: Date.now(), list: s.docs.map(norm).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || b.createdAt - a.createdAt) };
      }
      return titleCache.list;
    },
    async allTitles() { const s = await getDocs(collection(db, "titles")); return s.docs.map(norm).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)); },
    async title(id) { const s = await getDoc(doc(db, "titles", id)); return s.exists() ? norm(s) : null; },
    async episodes(id) { const s = await getDocs(query(collection(db, "titles", id, "episodes"), orderBy("n"))); return s.docs.map(norm); },
    async ads() { const s = await getDocs(query(collection(db, "ads"), where("active", "==", true))); return s.docs.map(norm); },
    async profile() { if (!uid()) return null; const s = await getDoc(doc(db, "users", uid())); return s.exists() ? norm(s) : null; },

    // Viewing numbers for Admin → Numbers (best effort, never blocks playback).
    track(type, data = {}) {
      if (!base) return;
      const body = JSON.stringify({ type, ...data });
      try { if (navigator.sendBeacon && navigator.sendBeacon(base + "/event", new Blob([body], { type: "text/plain" }))) return; } catch { /* fall back */ }
      fetch(base + "/event", { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(() => {});
    },
    reportProblem: (d) => call("/event", { type: "report", ...d }, { needAuth: false }),
    play: (titleId, epId, trailer) => call("/play", { titleId, epId: epId || undefined, trailer: !!trailer }, { needAuth: false }),
    subStatus: () => call("/sub", { action: "status" }),
    subStart: () => call("/sub", { action: "start" }),
    subVerify: (r) => call("/sub", { action: "verify", ...r }),
    subCancel: () => call("/sub", { action: "cancel" }),
    setDob: (dob) => call("/me", { action: "setDob", dob }),
    claimAdmin: async () => { await auth.currentUser?.reload(); return call("/me", { action: "claimAdmin" }); },
    async isAdmin() { if (!uid()) return false; try { return (await getDoc(doc(db, "admins", uid()))).exists(); } catch { return false; } },

    async getProgress() {
      if (!uid()) return {};
      const s = await getDocs(collection(db, "users", uid(), "progress")); const o = {};
      s.docs.forEach((d) => { o[d.id] = norm(d); }); return o;
    },
    async saveProgress(titleId, p) { if (uid()) await setDoc(doc(db, "users", uid(), "progress", titleId), { ...p, at: Date.now() }).catch(() => {}); },
    async myList() { if (!uid()) return []; const s = await getDocs(collection(db, "users", uid(), "list")); return s.docs.map(norm).sort((a, b) => b.at - a.at).map((d) => d.id); },
    async toggleList(id) {
      if (!uid()) throw Object.assign(new Error("Sign in to save titles."), { needSignIn: true });
      const ref = doc(db, "users", uid(), "list", id);
      if ((await getDoc(ref)).exists()) { await deleteDoc(ref); return false; }
      await setDoc(ref, { at: Date.now() }); return true;
    },
    grievance: wrap(async ({ name, email, title, text }) => {
      await addDoc(collection(db, "grievances"), { name: String(name).slice(0, 80), email: String(email).slice(0, 120), title: String(title || "").slice(0, 120), text: String(text).slice(0, 3000), uid: uid() || "", status: "open", at: serverTimestamp() });
      return true;
    }),

    /* ---------- chat support: the Lifeofline Helpdesk ---------- */
    watchSupportThread(id, cb) { return onSnapshot(doc(db, "support", id), (s) => cb(s.exists() ? norm(s) : null), () => cb(null)); },
    watchSupportMsgs(id, cb) { return onSnapshot(query(collection(db, "support", id, "msgs"), orderBy("at"), limit(300)), (s) => cb(s.docs.map(norm)), () => cb([])); },
    async supportSend(text, transcript, meta = {}) {
      const id = uid(), ref = doc(db, "support", id); const fresh = !(await getDoc(ref)).exists(); const b = writeBatch(db);
      b.set(ref, { uid: id, name: meta.name || "", role: meta.premium ? "Premium" : "Free", email: auth.currentUser?.email || "", app: "movies", status: "open", teamUnread: true, userUnread: false, lastText: text.slice(0, 300), lastFrom: id, lastAt: serverTimestamp(), ...(fresh ? { createdAt: serverTimestamp() } : {}) }, { merge: true });
      if (fresh && transcript) b.set(doc(collection(db, "support", id, "msgs")), { from: id, kind: "transcript", text: ("Before connecting, I asked the helper:\n" + transcript).slice(0, 2000), at: serverTimestamp() });
      b.set(doc(collection(db, "support", id, "msgs")), { from: id, text: text.slice(0, 2000), at: serverTimestamp() });
      await b.commit(); call("/support", { id }).catch(() => {});
    },
    async supportSeen() { try { await updateDoc(doc(db, "support", uid()), { userUnread: false }); } catch { /* no thread yet */ } },
    watchSupportThreads(cb) { return onSnapshot(query(collection(db, "support"), orderBy("lastAt", "desc"), limit(100)), (s) => cb(s.docs.map(norm)), () => cb([])); },
    async supportReply(id, text, name) {
      const b = writeBatch(db);
      b.set(doc(collection(db, "support", id, "msgs")), { from: "team", name: name || "", text: text.slice(0, 2000), at: serverTimestamp() });
      b.update(doc(db, "support", id), { teamUnread: false, userUnread: true, status: "open", lastText: text.slice(0, 300), lastFrom: "team", lastAt: serverTimestamp() });
      await b.commit(); call("/support", { id }).catch(() => {});
    },
    async supportStatus(id, status) { await updateDoc(doc(db, "support", id), { status, teamUnread: false }); },
    async supportMarkRead(id) { await updateDoc(doc(db, "support", id), { teamUnread: false }).catch(() => {}); },

    /* ---------- admin ---------- */
    saveTitle: wrap(async (t) => {
      const id = t.id || slug(t.title) + "-" + Math.random().toString(36).slice(2, 6);
      const { id: _drop, ...data } = t;
      await setDoc(doc(db, "titles", id), { ...data, updatedAt: serverTimestamp(), ...(t.id ? {} : { createdAt: serverTimestamp() }) }, { merge: true });
      titleCache = null; return id;
    }),
    deleteTitle: wrap(async (id) => {
      const eps = await getDocs(collection(db, "titles", id, "episodes"));
      await Promise.all(eps.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "titles", id)); titleCache = null; return true;
    }),
    saveEpisode: wrap(async (titleId, ep) => {
      const id = ep.id || "e" + Date.now().toString(36);
      const { id: _drop, ...data } = ep;
      await setDoc(doc(db, "titles", titleId, "episodes", id), data, { merge: true });
      const n = (await getDocs(collection(db, "titles", titleId, "episodes"))).size;
      await updateDoc(doc(db, "titles", titleId), { episodeCount: n }); titleCache = null;
      return id;
    }),
    deleteEpisode: wrap(async (titleId, id) => {
      await deleteDoc(doc(db, "titles", titleId, "episodes", id));
      const n = (await getDocs(collection(db, "titles", titleId, "episodes"))).size;
      await updateDoc(doc(db, "titles", titleId), { episodeCount: n }); return true;
    }),
    // Sends the file straight from the browser to Cloudflare (resumable, so big films survive a dropped connection).
    async uploadVideo(file, onProgress) {
      const r = await call("/admin", { action: "upload", size: file.size, name: file.name });
      if (r.test) { onProgress(100); return r.uid; }
      await loadScript("https://cdn.jsdelivr.net/npm/tus-js-client@4.1.0/dist/tus.min.js");
      await new Promise((res, rej) => {
        const up = new window.tus.Upload(file, {
          uploadUrl: r.uploadUrl, chunkSize: 50 * 1024 * 1024, retryDelays: [0, 3000, 8000, 15000, 30000],
          onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
          onSuccess: res, onError: (e) => rej(new Error("Upload stopped: " + (e?.message || "connection lost") + ". Try again; it continues where it left off.")),
        });
        up.start();
      });
      return r.uid;
    },
    videoStatus: (uidV) => call("/admin", { action: "video", uid: uidV }),
    async uploadImage(file, { wide = false } = {}) {
      const fd = new FormData();
      fd.append("file", file); fd.append("upload_preset", appConfig.cloudinaryUploadPreset); fd.append("folder", appConfig.cloudinaryFolder || "lifeofline-movies");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${appConfig.cloudinaryCloudName}/image/upload`, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.secure_url) throw new Error("The image didn't upload. Try a JPG or PNG under 10 MB.");
      return j.secure_url.replace("/upload/", `/upload/f_auto,q_auto,w_${wide ? 1920 : 900}/`);
    },
    async allAds() { const s = await getDocs(collection(db, "ads")); return s.docs.map(norm); },
    saveAd: wrap(async (a) => { const id = a.id || "ad" + Date.now().toString(36); const { id: _d, ...data } = a; await setDoc(doc(db, "ads", id), data, { merge: true }); return id; }),
    deleteAd: wrap(async (id) => { await deleteDoc(doc(db, "ads", id)); return true; }),
    grant: (email, days) => call("/admin", { action: "grant", email, days }),
    stats: () => call("/admin", { action: "stats" }),
    ai: (action, payload = {}) => call("/admin", { action, ...payload }),
  };
  return api;
}

