# Setting up Lifeofline Movies

About an hour, no terminal needed. Until a step is done, that part runs in **test mode** (sample video, no real payments), so the app works from the first deploy.

Services used, all the same accounts as ArtistCart except a new Firebase project and Cloudflare:

| Part | Service | Cost to start |
|---|---|---|
| App + API | Render (2 services from `render.yaml`) | Free; API on Starter ($7/month) before launch |
| Login + database | Firebase, a **new** project (Spark plan) | Free |
| Video | Cloudflare Stream | $5/month per 1,000 minutes stored + $1 per 1,000 minutes watched |
| Payments | Razorpay, the existing Lifeofline Pvt Ltd account | Razorpay's fee per payment |
| Email | Brevo, the existing ArtistCart key | Free (300 emails/day) |
| Posters, ad images | Cloudinary, the existing ArtistCart account | Free |

## 1. Firebase (new project)

ArtistCart's Firebase project stays separate, so its users and rules are never touched.

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it `lifeofline-movies`. Analytics can be off.
2. **Build → Authentication → Get started.** Turn on **Email/Password** and **Google**.
3. **Build → Firestore Database → Create database** → location **asia-south1 (Mumbai)** → production mode.
4. **Firestore → Rules:** replace everything with the contents of `firestore.rules` from this repo → **Publish**.
5. **Project settings (gear) → Your apps → Web (`</>`)** → register app → copy the `firebaseConfig` values into `public/config.js` (or send them to Claude to commit). They are not secret.
6. **Project settings → Service accounts → Generate new private key.** Keep the downloaded file safe; you paste it into Render in step 5. Never commit it.
7. After step 5: **Authentication → Settings → Authorized domains → Add domain** → `lifeofline-movies.onrender.com` (and your own domain later).

## 2. Cloudflare Stream (video)

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) → **Stream** → subscribe.
2. Copy your **Account ID** (right side of the Stream page or the dashboard home).
3. **My Profile → API Tokens → Create Token → Custom token**: permission **Account → Stream → Edit**, for your account → create → copy the token.
4. Optional: upload any short video in Stream and look at its link. The part like `customer-abc123` is your customer code (`abc123`).

## 3. Razorpay (same account as ArtistCart)

1. **Account & Settings → API Keys**: use the same live keys as ArtistCart (or generate a new pair).
2. **Account & Settings → Webhooks → Add new webhook** (a second one; ArtistCart's stays):
   - URL: `https://lifeofline-movies-api.onrender.com/pay/webhook`
   - Secret: make up a long random password and keep it for Render
   - Events: `payment.captured`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `subscription.resumed`
3. **Auto-renewing ₹499 yearly plan:** Subscriptions must be switched on for the account. Ask Razorpay support (Dashboard → Help) to enable **Subscriptions with UPI Autopay**. Until then the app sells a **1-year pass** for ₹499 (paid again to renew, with a reminder email), like ArtistCart's Collab membership. When Razorpay confirms, set `RAZORPAY_SUBSCRIPTIONS` to `on` in Render. The ₹499 yearly plan is created on Razorpay automatically on the first subscription.
4. Razorpay checks that payments come from the website registered on the account (lifeofline.com). If they flag the onrender.com address, add the domain in step 6 and register it with Razorpay.

## 4. Brevo

Nothing new: copy `BREVO_API_KEY` from ArtistCart's `kalakaar-notify` service on Render (Environment tab).

## 5. Render

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → pick **lifeofline/Lifeofline-Movies** → it reads `render.yaml` and shows two services.
2. Fill the empty values:
   - `FIREBASE_SERVICE_ACCOUNT`: open the key file from step 1.6 in Notepad, copy **all** of it, paste.
   - `CF_ACCOUNT_ID`, `CF_STREAM_TOKEN`, `CF_STREAM_CUSTOMER_CODE` from step 2.
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` from step 3.
   - `BREVO_API_KEY` from step 4.
3. **Apply.** First deploy takes a few minutes.
4. Open `https://lifeofline-movies-api.onrender.com/health`. It should say `"billing":"pass"` (or `"subscription"`) and `"video":"live"`. `"test"` means that service's keys are missing.
5. If Render gave a different address than `lifeofline-movies.onrender.com` / `lifeofline-movies-api.onrender.com` (name already taken), update `apiUrl` in `public/config.js` and `APP_URL` in the API's Environment tab.

## 6. Make yourself admin and add the first title

1. Open the app → **Sign in → Create an account** with **ibmhclms@gmail.com** (the email in `ADMIN_EMAILS`). Open the verification link in your inbox.
2. **Account → I'm on the admin list.** You are now an admin; **Open Admin** appears.
3. **Admin → Add a title**: fill the details, pick the age rating and content descriptor, upload a poster, save. Then upload episodes (or the film). Press **Check video** until it says Ready, tick **Published**, save.
4. **Admin → Free Premium** gives cast, crew and testers free access by email.

## Own web address: movies.lifeofline.com

Razorpay only takes payments from the website registered on the account (lifeofline.com), so the app runs at `movies.lifeofline.com`.

1. Render → **lifeofline-movies** (the static site) → **Settings → Custom Domains → Add** → `movies.lifeofline.com`. Render shows a CNAME target like `lifeofline-movies.onrender.com`.
2. At the company where lifeofline.com's DNS is managed, add a record: **Type** CNAME · **Name/Host** `movies` · **Value/Points to** the target Render showed · TTL default.
3. Back in Render, press **Verify**. The HTTPS certificate follows within minutes to an hour.
4. Firebase → Authentication → Settings → Authorized domains → add `movies.lifeofline.com`.
5. Render → **lifeofline-movies-api → Environment** → `APP_URL` = `https://movies.lifeofline.com` (links in emails).
6. Razorpay → Account & Settings → website / app details: add `https://movies.lifeofline.com` if Razorpay asks for each subdomain.

Visitors on the old onrender.com address are moved to the new one automatically once it works.

## Before launch

- Render → `lifeofline-movies-api` → **Settings → Instance type → Starter** so the first play is never delayed by a cold start.
- Add a custom domain (e.g. `movies.lifeofline.com`) to the static site in Render, then add it to Firebase authorized domains.
- Have a lawyer review `terms.html`, `privacy.html`, `refund.html` and `content-policy.html`, and confirm the Grievance Officer's name and email.
- Phone app stores and TV stores: the web app installs to the home screen now and works in TV browsers with the remote. Packaging for Google Play, Android TV and Fire TV (a Trusted Web Activity, as planned for ArtistCart) is the next step.
