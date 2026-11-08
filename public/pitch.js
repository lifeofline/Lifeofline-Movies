// "Make it with us": the page that invites filmmakers to pitch to Lifeofline Movies (#pitch), and the row of
// five open slots on Home. Pitches go by email to movies@lifeofline.com; nothing is stored on the site.
import { esc } from "./util.js";

export const PITCH_EMAIL = "movies@lifeofline.com";

// Eight open slots, each a theme we'd like to commission. Hue = the slot card's colour.
export const SLOTS = [
  { n: 1, topic: "Folk tales, retold", format: "Short film or mini-series · 15–40 min", hue: 28,
    blurb: "A legend from your village, a story your grandmother told, a god or ghost from a regional tradition, told for today.",
    ideas: ["A local legend set in the present day", "Folk music or theatre as the story's heartbeat", "Any Indian language, with subtitles"] },
  { n: 2, topic: "Small-town love stories", format: "Feature, short film or web series", hue: 340,
    blurb: "First love, late love, love across class or caste lines, love by letter or by Instagram, in towns the big screen forgets.",
    ideas: ["Real places, real dialect", "Warm, funny, bittersweet", "Episodes of 10–25 min work well"] },
  { n: 3, topic: "Crime in the city", format: "Thriller series or feature", hue: 220,
    blurb: "Gripping, grounded crime: a scam, a disappearance, a con artist, a cop on the edge. Tight plots and twists that land.",
    ideas: ["Inspired by real headlines (fictionalised)", "Strong first episode hook", "Shot lean, on real locations"] },
  { n: 4, topic: "Women who lead", format: "Drama, biopic or documentary", hue: 280,
    blurb: "Women who run the show: a sarpanch, a boxer, a founder, a mother who took on the system. True stories and fiction.",
    ideas: ["Real-life heroes from your region", "Drama with heart and grit", "Documentaries welcome"] },
  { n: 5, topic: "Artists' journeys", format: "Documentary, music film or podcast", hue: 160,
    blurb: "The life of a singer, dancer, painter or theatre troupe: the struggle, the craft and the stage. Podcasts and music films too.",
    ideas: ["Behind-the-scenes access", "Performances in full", "Video podcasts with artists"] },
  { n: 6, topic: "Everyday comedy", format: "Sitcom, sketch series or short film", hue: 48,
    blurb: "The joke is in the everyday: a joint family, a chaotic office, a wedding gone sideways, neighbours who never stop talking.",
    ideas: ["Short episodes of 5–15 min", "Relatable characters, regional humour", "Clean comedy the whole family can watch"] },
  { n: 7, topic: "Youth & campus", format: "Web series or short drama", hue: 190,
    blurb: "Hostels, exams, first jobs, friendships and heartbreaks: what it feels like to be 18 to 25 in India right now.",
    ideas: ["Fresh faces and real campuses", "Vertical (9:16) short dramas welcome", "Honest, fun and a little messy"] },
  { n: 8, topic: "Horror & the unexplained", format: "Anthology, series or feature", hue: 0,
    blurb: "Haunted havelis, highway legends, village curses and things that go bump at 3 am. Slow dread or full scares.",
    ideas: ["Folk horror from your region", "One story per episode works well", "Sound and atmosphere over big effects"] },
];

const mail = (s) => `mailto:${PITCH_EMAIL}?subject=${encodeURIComponent(s ? `Pitch: Slot ${String(s.n).padStart(2, "0")} – ${s.topic}` : "Pitch for Lifeofline Movies")}&body=${encodeURIComponent(
  "Title:\nFormat and length (film / series / short / podcast):\nLanguage:\nOne-line idea (logline):\nShort synopsis:\nStage (idea / script / shooting / finished):\nTrailer, pilot or sample link:\nYour name, role and phone:\n")}`;

function slotCard(s, big = false) {
  return `<article class="slot${big ? " big" : ""}" style="--h:${s.hue}">
    <div class="slot-poster"><span class="slot-n">SLOT ${String(s.n).padStart(2, "0")}</span><span class="slot-open">OPEN</span>
      <div class="slot-mid"><span class="slot-plus">＋</span><b>Your film here</b></div><span class="slot-topic">${esc(s.topic)}</span></div>
    ${big ? `<div class="slot-body"><h3>${esc(s.topic)}</h3><p class="small">${esc(s.format)}</p><p>${esc(s.blurb)}</p>
      <ul>${s.ideas.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      <a class="btn gold" href="${mail(s)}">Pitch for this slot</a></div>` : ""}
  </article>`;
}

// Home row: eight blank posters that lead to the pitch page.
export function slotRail() {
  return `<section class="rail"><div class="rail-h"><h2>Open slots · your film here</h2><a href="#pitch" data-nav>Pitch to us</a></div>
    <div class="slotrow">${SLOTS.map((s) => `<a href="#pitch" data-nav class="slotlink" aria-label="Open slot ${s.n}: ${esc(s.topic)}">${slotCard(s)}</a>`).join("")}</div></section>`;
}

export function vPitch() {
  const step = (n, t, d) => `<li><span>${n}</span><div><b>${t}</b><p class="small">${d}</p></div></li>`;
  return `<div class="pitch">
    <section class="pitch-hero">
      <span class="eyebrow">For filmmakers, writers and creators</span>
      <h1>Your story could stream on Lifeofline Movies</h1>
      <p>We're building an OTT home for original Indian stories. Films, web series, short dramas, documentaries and podcasts from independent creators, made with heart. Eight slots are open right now. Pick a theme, pitch your work, and let's make it together.</p>
      <div class="row"><a class="btn gold" href="${mail(null)}">Email your pitch</a><button type="button" class="btn ghost" onclick="document.getElementById('slots').scrollIntoView({behavior:'smooth'})">See the 8 open slots</button></div>
      <p class="small">Write to <a href="${mail(null)}">${PITCH_EMAIL}</a></p>
    </section>

    <section id="slots" class="pitch-sec"><h2>8 open slots</h2><p class="small">Each slot is a theme we want to commission. Any Indian language. Finished films, works in progress and strong ideas all welcome.</p>
      <div class="slotgrid">${SLOTS.map((s) => slotCard(s, true)).join("")}</div></section>

    <section class="pitch-sec two">
      <div class="card"><h2>How it works</h2><ol class="steps">
        ${step(1, "Email your pitch", `Send it to ${PITCH_EMAIL}: the idea, a short synopsis and a sample if you have one.`)}
        ${step(2, "We watch and read", "Our team reviews every pitch and replies to the ones that fit a slot.")}
        ${step(3, "Shape it together", "We agree the format, the episodes and the terms with you, project by project.")}
        ${step(4, "Premiere on Lifeofline", "Your work streams on movies.lifeofline.com and is promoted to the artist community on ArtistCart.")}
      </ol></div>
      <div class="card"><h2>What to send</h2><ul class="ticks">
        <li>Title and one-line idea (logline)</li><li>Format and length: film, series, short drama or podcast</li><li>Language and a short synopsis</li>
        <li>Where it stands: idea, script, shooting or finished</li><li>A trailer, pilot or sample link, if you have one</li><li>Your name, role, team and phone number</li></ul>
        <p class="small">Send links, not large files. Only pitch work you own or have the rights to.</p>
        <a class="btn gold" href="${mail(null)}">Email ${PITCH_EMAIL}</a></div>
    </section>
  </div>`;
}
