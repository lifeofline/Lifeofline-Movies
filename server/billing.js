// Premium: ₹99 a month through Razorpay (the Lifeofline Pvt Ltd account already used by ArtistCart).
//
// Two ways to charge, picked on Render:
//   RAZORPAY_SUBSCRIPTIONS=on  → auto-renewing subscription (UPI Autopay, cards, e-mandate). Needs Razorpay
//                                Subscriptions switched on for the account.
//   (not set)                  → a 30-day pass paid with a normal order, like ArtistCart's Collab membership.
//                                Works today; people renew by paying again (they get a reminder email).
// Without RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET everything runs in TEST MODE: nothing is charged.
//
// The person's Premium state lives in subs/{uid}, which only this service writes:
//   { status: "active" | "cancelling" | "halted" | "ended", mode: "subscription" | "pass" | "test" | "gift",
//     until: <ms, Premium works until then>, rzpSubId?, startedAt, reminded? }
const crypto = require("crypto");

const PRICE = Number(process.env.PREMIUM_PRICE || 99); // ₹ incl. GST
const PASS_DAYS = 30;
const GRACE_MS = 2 * 864e5; // Autopay debits can land a day late

module.exports = function makeBilling({ db, FieldValue, env, sendEmail, link }) {
  const clean = (v) => String(v || "").trim().replace(/^["']|["']$/g, ""); // pasted values often carry spaces or quotes
  const KEY = clean(env.RAZORPAY_KEY_ID), SECRET = clean(env.RAZORPAY_KEY_SECRET);
  const LIVE = !!(KEY && SECRET);
  const SUBS = LIVE && env.RAZORPAY_SUBSCRIPTIONS === "on";
  const MODE = !LIVE ? "test" : SUBS ? "subscription" : "pass";
  const show = (msg, code = 400) => Object.assign(new Error(msg), { show: true, status: code });
  const now = () => Date.now();
  const day = (ms) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const ref = (uid) => db.doc(`subs/${uid}`);
  const same = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const hmac = (s, secret = SECRET) => crypto.createHmac("sha256", secret).update(s).digest("hex");

  async function rzp(method, path, body) {
    let res;
    try {
      res = await fetch("https://api.razorpay.com" + path, {
        method, headers: { Authorization: "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64"), "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { console.error("Razorpay network", e.message, e.cause?.message || ""); throw show("Couldn't reach Razorpay: " + (e.cause?.message || e.message) + ". Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Render.", 400); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Razorpay", method, path, res.status, JSON.stringify(data));
      const d = data?.error?.description || "";
      const hint = res.status === 401 || /auth/i.test(d) ? " Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on Render (live keys, both from the same pair)." : "";
      throw show(`Razorpay refused this (${res.status}${d ? ": " + d : ""}).${hint}`, 400);
    }
    return data;
  }

  async function isPremium(uid) {
    if (!uid) return false;
    const s = (await ref(uid).get()).data();
    return !!s && s.until > now() && s.status !== "halted";
  }

  // The monthly plan is created once on Razorpay and remembered.
  async function planId() {
    if (env.RAZORPAY_PLAN_ID) return env.RAZORPAY_PLAN_ID;
    const cfg = db.doc("server/razorpay"); const c = (await cfg.get()).data() || {};
    if (c.planId && c.price === PRICE) return c.planId;
    const p = await rzp("POST", "/v1/plans", { period: "monthly", interval: 1, item: { name: "Lifeofline Movies Premium", amount: PRICE * 100, currency: "INR", description: "All movies, series and short dramas. No ads." } });
    await cfg.set({ planId: p.id, price: PRICE, createdAt: now() }, { merge: true });
    return p.id;
  }

  async function grant(uid, { mode, days, until, rzpSubId, paymentId }) {
    const r = ref(uid);
    const res = await db.runTransaction(async (tx) => {
      const s = (await tx.get(r)).data() || {};
      const base = Math.max(now(), s.until || 0);
      const end = until || base + days * 864e5;
      const fresh = !(s.until > now()) || s.status === "halted";
      tx.set(r, { status: "active", mode, until: end, rzpSubId: rzpSubId || s.rzpSubId || "", lastPaymentId: paymentId || "", startedAt: s.startedAt || now(), updatedAt: now(), reminded: FieldValue.delete() }, { merge: true });
      return { fresh, until: end };
    });
    if (res.fresh) await sendEmail(uid, "Welcome to Lifeofline Movies Premium", [
      `Every movie, series and short drama is now unlocked, with no ads.`,
      mode === "subscription" ? `Your ₹${PRICE} plan renews every month. You'll get a notice before each charge, and you can cancel anytime in Account.` : `Your Premium pass is active till ${day(res.until)}.`,
    ], { label: "Start watching", url: link("") }).catch(() => {});
    return res.until;
  }

  const actions = {
    // What the Plans and Account pages show.
    async status(uid) {
      const s = (await ref(uid).get()).data() || null;
      return { mode: MODE, price: PRICE, premium: !!s && s.until > now() && s.status !== "halted", sub: s };
    },

    async start(uid) {
      const s = (await ref(uid).get()).data() || {};
      if (s.until > now() && s.status === "active" && s.mode === "subscription") throw show("You already have Premium.");
      if (MODE === "test") return { mode: "test", price: PRICE };
      if (MODE === "subscription") {
        const sub = await rzp("POST", "/v1/subscriptions", { plan_id: await planId(), total_count: 120, customer_notify: 1, notes: { uid, app: "lifeofline-movies" } });
        await ref(uid).set({ pendingSubId: sub.id, updatedAt: now() }, { merge: true });
        return { mode: MODE, keyId: KEY, subscriptionId: sub.id, price: PRICE };
      }
      const order = await rzp("POST", "/v1/orders", { amount: PRICE * 100, currency: "INR", receipt: ("lm_" + uid).slice(0, 40), notes: { uid, app: "lifeofline-movies" } });
      await db.doc(`passOrders/${order.id}`).set({ uid, amount: PRICE, status: "created", createdAt: now() });
      return { mode: MODE, keyId: KEY, orderId: order.id, price: PRICE };
    },

    // After the Razorpay window closes successfully: check the signature, then switch Premium on.
    async verify(uid, b) {
      if (MODE === "test") return { until: await grant(uid, { mode: "test", days: PASS_DAYS, paymentId: "test_" + crypto.randomBytes(6).toString("hex") }) };
      const pid = String(b.razorpay_payment_id || ""), sig = String(b.razorpay_signature || "");
      if (MODE === "subscription") {
        const s = (await ref(uid).get()).data() || {};
        const subId = String(b.razorpay_subscription_id || "");
        if (!s.pendingSubId || subId !== s.pendingSubId || !same(hmac(`${pid}|${subId}`), sig)) throw show("We couldn't confirm this payment. If money was taken, it will be refunded automatically.");
        return { until: await grant(uid, { mode: "subscription", days: 31, rzpSubId: subId, paymentId: pid }) };
      }
      const orderId = String(b.razorpay_order_id || "");
      const o = (await db.doc(`passOrders/${orderId}`).get()).data();
      if (!o || o.uid !== uid || !same(hmac(`${orderId}|${pid}`), sig)) throw show("We couldn't confirm this payment. If money was taken, it will be refunded automatically.");
      return { until: await payPass(orderId, pid) };
    },

    // Stops renewal. Premium keeps working until the end of the period already paid for.
    async cancel(uid) {
      const s = (await ref(uid).get()).data();
      if (!s || !(s.until > now())) throw show("You don't have an active plan.");
      if (s.mode === "subscription" && s.rzpSubId && LIVE) await rzp("POST", `/v1/subscriptions/${s.rzpSubId}/cancel`, { cancel_at_cycle_end: 1 });
      await ref(uid).update({ status: "cancelling", updatedAt: now() });
      await sendEmail(uid, "Your Premium won't renew", [`You'll keep Premium till ${day(s.until)}. After that you can still watch free titles with ads.`, "Changed your mind? Subscribe again anytime from Plans."], { label: "Open Lifeofline Movies", url: link("plans") }).catch(() => {});
      return { until: s.until };
    },
  };

  async function payPass(orderId, paymentId) {
    const r = db.doc(`passOrders/${orderId}`);
    const o = await db.runTransaction(async (tx) => {
      const d = (await tx.get(r)).data();
      if (!d) return null;
      if (d.status === "paid") return { ...d, already: true };
      tx.update(r, { status: "paid", paymentId, paidAt: now() });
      return d;
    });
    if (!o) throw show("Payment not found.", 404);
    if (o.already) return ((await ref(o.uid).get()).data() || {}).until || now(); // webhook and app both reported it
    return grant(o.uid, { mode: "pass", days: PASS_DAYS, paymentId });
  }

  // Razorpay webhook (Settings → Webhooks). Keeps Premium in step with renewals, cancellations and failed debits.
  async function webhook(raw, signature) {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return { status: 400, body: { error: "webhook secret not set" } };
    if (!same(hmac(raw, secret), signature)) return { status: 401, body: { error: "bad signature" } };
    const ev = JSON.parse(raw);
    const sub = ev?.payload?.subscription?.entity, pay = ev?.payload?.payment?.entity;
    const uid = sub?.notes?.uid || pay?.notes?.uid;
    // ArtistCart's payments go to the same Razorpay account; ignore anything that isn't ours.
    if ((sub?.notes?.app || pay?.notes?.app) !== "lifeofline-movies" && !(pay?.order_id && (await db.doc(`passOrders/${pay.order_id}`).get()).exists)) return { status: 200, body: { ok: true, ignored: true } };
    try {
      if (ev.event === "payment.captured" && pay?.order_id && !sub) await payPass(pay.order_id, pay.id);
      if (sub && uid) {
        if (["subscription.activated", "subscription.charged", "subscription.resumed"].includes(ev.event)) {
          const end = (sub.current_end ? sub.current_end * 1000 : now() + 31 * 864e5) + GRACE_MS;
          await grant(uid, { mode: "subscription", until: end, rzpSubId: sub.id, paymentId: pay?.id });
        } else if (ev.event === "subscription.halted" || ev.event === "subscription.pending") {
          await ref(uid).set({ status: ev.event === "subscription.halted" ? "halted" : "active", updatedAt: now() }, { merge: true });
          if (ev.event === "subscription.halted") await sendEmail(uid, "Your Premium payment didn't go through", ["We couldn't renew your ₹" + PRICE + " plan, so ads are back and Premium titles are locked.", "Subscribe again from Plans to unlock everything."], { label: "Fix my plan", url: link("plans") }).catch(() => {});
        } else if (ev.event === "subscription.cancelled" || ev.event === "subscription.completed") {
          await ref(uid).set({ status: "cancelling", updatedAt: now() }, { merge: true });
        }
      }
    } catch (e) { console.error("webhook", ev.event, e.message); }
    return { status: 200, body: { ok: true } };
  }

  // Hourly: remind 30-day pass holders 3 days before it ends, and mark ended plans.
  async function hourly() {
    try {
      const soon = await db.collection("subs").where("until", ">", now()).where("until", "<=", now() + 3 * 864e5).get();
      for (const d of soon.docs) {
        const s = d.data();
        if (s.mode === "subscription" && s.status === "active") continue; // renews by itself
        if (s.reminded === s.until) continue;
        await d.ref.update({ reminded: s.until });
        await sendEmail(d.id, "Your Premium ends soon", [`Your Lifeofline Movies Premium ends on ${day(s.until)}.`, `Renew for ₹${PRICE} to keep watching everything without ads.`], { label: "Renew", url: link("plans") }).catch(() => {});
      }
    } catch (e) { console.error("billing hourly", e.message); }
  }

  async function handle(uid, body) {
    const { action } = body || {};
    if (!actions[action]) return { status: 400, body: { error: "bad request" } };
    try { return { status: 200, body: { result: await actions[action](uid, body) } }; }
    catch (e) { if (e.show) return { status: e.status || 400, body: { error: e.message } }; throw e; }
  }

  return { LIVE, MODE, PRICE, handle, webhook, hourly, isPremium, grant };
};
