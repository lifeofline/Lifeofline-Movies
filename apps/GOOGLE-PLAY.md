# Lifeofline Movies on Google Play

The Play app opens the live site (https://movies.lifeofline.com) full-screen, the same way the ArtistCart app does. Every change pushed to the website shows up in the app straight away; you only rebuild the app to change its icon, name or settings.

| | |
|---|---|
| How it's made | Trusted Web Activity: Chrome runs the site full-screen, no address bar |
| Package name | `com.lifeofline.movies` |
| Project | `apps/android/` |
| Built by | GitHub Actions → **Android app (Google Play)** |
| Result | `app-release.aab` to upload to Play Console |
| Account | The same Google Play developer account as ArtistCart (Lifeofline Private Limited) |
| Premium | **Not sold inside the Play app** (Google's billing rules for digital subscriptions). The app shows "Premium isn't available in this app"; people who bought Premium on the website sign in and everything unlocks |
| Rotation | Follows the phone, so videos can go full-screen sideways |

## 1. Add the signing key to GitHub (once)
GitHub → **Lifeofline-Movies → Settings → Secrets and variables → Actions → New repository secret**. Add two secrets from the files Claude gave you:
- `ANDROID_KEYSTORE_BASE64`: the whole text of `keystore-base64.txt`
- `ANDROID_KEYSTORE_PASSWORD`: the text of `password.txt`

Keep `lifeofline-movies-upload.jks` and the password somewhere safe (Google Drive + a password manager), then delete the copies from Downloads. If they are lost, Google support can reset the upload key, but it takes days.

## 2. Build the app
GitHub → **Actions → Android app (Google Play) → Run workflow** → version `1.0.0` → **Run workflow**. About 5 minutes. Open the finished run → **Artifacts → LifeoflineMovies-android** → download and unzip: `app-release.aab`.
If the run fails, screenshot the red step and send it to Claude.

## 3. Create the app in Play Console
1. [play.google.com/console](https://play.google.com/console) → **Create app** → name **Lifeofline Movies** · App · **Free** · accept the declarations.
2. **Test and release → Testing → Internal testing → Create new release** → keep **Play App Signing** on → upload `app-release.aab` → release name `1.0.0` → **Save → Review → Start rollout**. Add your own Gmail as a tester and install it from the link.

## 4. Link the app to movies.lifeofline.com (removes the address bar)
Play Console → **Test and release → App integrity → App signing** → copy **App signing key certificate → SHA-256 fingerprint** → send it to Claude, who adds it to `public/assetlinks.json` next to the upload key's. Until then the app works but may show a small address bar at the top.

## 5. Store listing and App content
**Main store listing**
- App name: `Lifeofline Movies`
- Short description (80): `Ghalib Zinda Hai and Indian short dramas, films and series. Free to start.`
- Full description:
  > Lifeofline Movies brings Indian stories to your phone: Lifeofline Originals, vertical short dramas, films and web series.
  >
  > • Ghalib Zinda Hai: Mirza Ghalib, brought to life from his only photograph, recites his greatest ghazals and explains what they mean.
  > • Short dramas made for your phone, and films and series for your TV or computer.
  > • Pick up where you left off on any device, and keep a My List.
  > • Kids mode with a PIN, and age ratings on every title.
  > • Hindi, Punjabi and more languages coming.
  >
  > Made by Lifeofline Private Limited.
- App icon: `public/icon-512.png` · Feature graphic: 1024×500 (ask Claude to make one) · Phone screenshots: at least 2 (ask Claude, or take them on your phone)
- Category: **Entertainment** · Contact email: movies@lifeofline.com · Website: https://movies.lifeofline.com

**Policy → App content**
- Privacy policy: https://movies.lifeofline.com/privacy.html
- Ads: **Yes** (the free tier has ad breaks)
- App access: give the reviewer a test account (email + password) so they can sign in
- Content rating: fill the questionnaire honestly (classical poetry, mentions of wine and death; other titles may be rated U/A or A)
- Target audience: **18+** (the app has A-rated titles; Kids mode is a filter, not a kids app)
- Data safety: collects email and name (account), watch progress (app functionality), purchase history for Premium bought on the website; data encrypted in transit; users can ask for deletion at movies@lifeofline.com
- Account deletion URL: https://movies.lifeofline.com/#grievance (or ask Claude to add a dedicated delete-account page)

## 6. Go live
**Production → Create new release** → add the same `.aab` (or a newer build) → **Send for review**. Reviews take 1–7 days. Each new upload needs a new run of the workflow (the version code goes up by itself).

## TV and iPhone
- **Android TV / Fire TV:** the website already switches to a TV layout on TV browsers. A separate TV app needs its own build (Chrome isn't available on most TVs); ask Claude when you want it.
- **iPhone:** people add it from Safari (Share → Add to Home Screen); the site shows them how. An App Store app needs an Apple Developer account ($99 a year) and can be made the same way as ArtistCart's.
