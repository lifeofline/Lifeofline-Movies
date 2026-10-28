// Live-mode payment flow with a fake Razorpay (no network): `node test-payments.js`.
(async () => {
  const crypto = require("crypto");
  const store = new Map();
  const doc = (p) => ({ get: async () => ({ exists: store.has(p), data: () => store.get(p) }), set: async (v, o) => store.set(p, o?.merge ? { ...(store.get(p) || {}), ...v } : v), update: async (v) => store.set(p, { ...store.get(p), ...v }) });
  const db = { doc, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v) }) };
  const FV = { delete: () => undefined, increment: (n) => n };
  global.fetch = async (u) => new Response(JSON.stringify(u.includes("/plans") ? { id: "plan_1" } : u.includes("/subscriptions") ? { id: "sub_9" } : { id: "order_1" }), { status: 200 });
  for (const subs of ["off", "on"]) {
    const B = require("./billing.js")({ db, FieldValue: FV, env: { RAZORPAY_KEY_ID: "rzp_live_k", RAZORPAY_KEY_SECRET: "sec", RAZORPAY_SUBSCRIPTIONS: subs }, sendEmail: async () => {}, link: (x) => x });
    const r = await B.handle("u9", { action: "start" });
    if (r.status !== 200) throw new Error(`start (${subs}) failed: ${JSON.stringify(r.body)}`);
    const o = r.body.result;
    const pid = "pay_" + subs;
    const signed = subs === "on" ? `${pid}|${o.subscriptionId}` : `${o.orderId}|${pid}`;
    const sig = crypto.createHmac("sha256", "sec").update(signed).digest("hex");
    const v = await B.handle("u9", { action: "verify", razorpay_payment_id: pid, razorpay_signature: sig, razorpay_order_id: o.orderId, razorpay_subscription_id: o.subscriptionId });
    if (v.status !== 200 || !(v.body.result.until > Date.now())) throw new Error(`verify (${subs}) failed: ${JSON.stringify(v.body)}`);
  }
  console.log("Live-mode payment checks passed.");
})().catch((e) => { console.error(e); process.exit(1); });
