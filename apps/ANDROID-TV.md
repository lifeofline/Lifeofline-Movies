# Lifeofline Movies on Android TV / Google TV

The TV app opens the live site (https://movies.lifeofline.com) full screen, like the phone app. Changes pushed to the website show up on TVs straight away. You only rebuild the app to change its icon, name or settings.

| | |
|---|---|
| How it's made | A full-screen web view. TVs don't have Chrome, so the phone app's Trusted Web Activity can't run there. |
| Package name | `com.lifeofline.movies`, the same as the phone app, so it is **one Play listing** with an extra **Android TV** release track. |
| Project | `apps/androidtv/` |
| Built by | GitHub Actions → **Android TV app (Google Play)** |
| Result | `app-release.aab` for Play Console, plus `app-debug.apk` to try on your own TV first |
| Version codes | Start at 1,000,001 so they never clash with the phone app's |
| What the site does on a TV | It sees `LifeoflineTV` in the browser name and turns on the TV layout: big tiles and remote-control arrows. Premium isn't sold there (Google's rules). Google and Facebook sign-in are hidden because they block sign-in inside apps. Email and mobile-number sign-in work. |
| Remote in the player | OK plays or pauses. ◀ ▶ skip 10 seconds. On a ghazal, ▲ repeats the last sher and ▼ jumps to the next sher. Back closes the player. |

## 1. Build it
The signing key secrets you added for the phone app are reused, so there's nothing new to add.
GitHub → **Actions → Android TV app (Google Play) → Run workflow** → version `1.0.0` → **Run workflow**. It takes about 5 minutes. When it finishes, open the run → **Artifacts**:
- **LifeoflineMovies-androidtv** → `app-release.aab` (for Play)
- **LifeoflineMovies-androidtv-test-apk** → `app-debug.apk` (for your own TV)

## 2. Try it on your TV first (optional, 5 minutes)
1. On the TV, go to **Settings → System → About** and press **OK** on **Android TV OS build** 7 times. This turns on developer options.
2. Go to **Settings → System → Developer options** and turn on **USB debugging**, or **Apps from unknown sources** for the app you'll install with.
3. Get `app-debug.apk` onto the TV. The easiest way is the **Send Files to TV** app (on the phone and on the TV), or a USB stick with a file manager.
4. Open it to install. It shows up in the Apps row as **Lifeofline Movies**, next to the Play version, and doesn't replace it.

## 3. Add the TV track in Play Console
1. Play Console → **Lifeofline Movies** → **Test and release → Advanced settings → Form factors → + Add form factor → Android TV**.
2. Accept the Android TV terms. Play adds an **Android TV** track.
3. **Test and release → Android TV → Internal testing** → **Create new release** → upload `app-release.aab` → **Save → Review → Start rollout**.
4. **Grow users → Store presence → Main store listing → Android TV**:
   - **TV banner**: `apps/androidtv/store/tv-banner-1280x720.png`
   - **TV screenshots** (1920×1080): the seven in `apps/androidtv/store/screenshots/`.
5. When internal testing looks good, promote the release to **Production** on the Android TV track. Google reviews TV apps by hand, which usually takes a few days. Typical reasons for a rejection are listed below.

## 4. What Google's TV review checks (already handled)
- The app shows up in the TV launcher (`LEANBACK_LAUNCHER`) with a 320×180 banner.
- It doesn't need a touch screen, and everything works with the D-pad.
- Back always works: it leaves full screen, then goes back in the site, then exits the app from the home screen.
- Video plays full screen with no system bars.
- Nothing in the app asks the viewer to buy Premium.

If Play rejects the TV release, screenshot the email and send it to Claude.
