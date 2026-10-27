# Lifeofline Movies

Streaming for Indian short dramas, movies and web series, by Lifeofline Pvt Ltd. Free with ads, or everything for ₹99 a month. One web app for phones, computers and TVs.

**To launch it, follow [SETUP.md](SETUP.md).** Built the same way as ArtistCart: no build step, Render + Firebase + Brevo + Razorpay, plus Cloudflare Stream for video.

## How it's put together

| Part | Runs on | Folder |
|---|---|---|
| The app people open (installs to the home screen; TV layout with remote control) | Render static site | `public/` |
| Login, catalogue, watch progress, My List | Firebase (new `lifeofline-movies` project) | rules in `firestore.rules` |
| Playback links, Premium payments, video uploads, emails | Render web service `lifeofline-movies-api` | `server/` |
| Video storage and streaming (signed links, adaptive quality) | Cloudflare Stream | `server/stream.js` |
| ₹99 Premium (auto-renew subscription or 30-day pass) | Razorpay | `server/billing.js` |
| Render setup | Blueprint | `render.yaml` |

With `config.js` still holding `PASTE` placeholders, the app runs in **demo mode** with sample titles. With no Cloudflare or Razorpay keys on Render, the API runs in **test mode**. `cd server && npm install && npm test` checks the API offline.

## Features

- Home with rails by type and language, Continue watching, My List, search
- Reels: vertical short dramas, swipe for the next episode
- Player: age-rating card before every title, ad break and mid-roll for free viewers, resume where you stopped, quality menu, auto-next, keyboard and TV-remote control
- Free rules: free titles fully; Premium short dramas episodes 1–3, series episode 1, movies trailer only (changeable per title or episode); enforced by the server
- ₹99 Premium via Razorpay (UPI Autopay subscription or 30-day pass), cancel anytime, emails for welcome, renewal reminder, failed payment
- IT Rules 2021: five age ratings, content descriptors, Kids mode with a PIN, date-of-birth check for A titles, grievance form, content classification policy
- Admin: titles, episodes, resumable video upload straight to Cloudflare, posters, trailers, house ads, free Premium for cast and testers, numbers

## Adding things later

Plans, prices and free-episode rules are data, not hard-coded screens. Yearly and Family plans, rentals and coins plug into `server/billing.js`; new languages are one line in `public/access.js`.
