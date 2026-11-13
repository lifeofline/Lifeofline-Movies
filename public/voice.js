// Hands-free voice commands in the player: switch on once, then just say "phir se", "dobara", "agla", "ruko"…
// Uses the browser's own speech recognition (Chrome / Android / the Play app; Safari on iPhone where Siri is on),
// listening in Hindi with English words understood too. Works while the app is open on screen; phones don't let a
// website listen with the screen locked (for that, the earphone button and "Hey Google / Hey Siri, previous" work).
//
// Ghalib's own voice is coming out of the same phone, so only SHORT phrases count as commands: the recitation
// arrives as long sentences and is ignored, a command is one to three words.

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const voiceSupported = () => !!SR;

// Command words, in Devanagari (what Hindi recognition usually returns), Urdu and Roman/English.
const COMMANDS = [
  ["repeat", ["फिर से", "फिरसे", "फ़िर से", "दोबारा", "दुबारा", "एक बार और", "फिर", "रिपीट", "पीछे", "phir se", "phirse", "fir se", "firse", "dobara", "dubara", "again", "repeat", "once more", "back", "pichhe", "dobaara", "پھر سے", "دوبارہ"]],
  ["next", ["अगला", "अगली", "आगे", "नेक्स्ट", "agla", "agli", "next", "aage", "اگلا"]],
  ["prev", ["पिछला", "पिछली", "pichla", "pichhla", "previous", "پچھلا"]],
  ["pause", ["रुको", "रुकिए", "रुक जाओ", "बंद", "पॉज़", "पॉज", "स्टॉप", "ruko", "rukiye", "stop", "pause", "band karo", "رکو"]],
  ["play", ["चलाओ", "चलो", "शुरू", "प्ले", "सुनाओ", "chalao", "chalo", "shuru", "play", "resume", "continue", "sunao", "چلاؤ"]],
];

export function parseCommand(text) {
  const t = String(text || "").toLowerCase().replace(/[.,!?।؟]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const words = t.split(" ").length;
  if (words > 4) return null; // long = Ghalib speaking, not the listener
  for (const [cmd, keys] of COMMANDS) {
    // "फिर" alone only counts when it's the whole phrase (it's common inside verses)
    if (keys.some((k) => (k === "फिर" ? t === k : t === k || t.startsWith(k + " ") || t.endsWith(" " + k) || t.includes(" " + k + " ") || (k.length > 3 && t.includes(k))))) return cmd;
  }
  return null;
}

// Starts listening; returns { stop }. Restarts by itself (browsers end a session after a pause) until stopped.
export function startVoice({ onCommand, onState, lang = "hi-IN" }) {
  if (!SR) { onState?.("unsupported"); return { stop() {} }; }
  let rec = null, on = true, last = 0, fails = 0, restartT = 0;
  const make = () => {
    rec = new SR();
    rec.lang = lang; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 3;
    rec.onstart = () => { fails = 0; onState?.("listening"); };
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        // Only finished phrases: the first words of a verse (heard while Ghalib recites) can look like a command.
        if (!r.isFinal) continue;
        for (let a = 0; a < r.length; a++) {
          const cmd = parseCommand(r[a].transcript);
          if (!cmd) continue;
          // Ignore the same words heard again for a moment.
          if (Date.now() - last < 1800) return;
          last = Date.now(); onCommand(cmd, r[a].transcript); return;
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { on = false; onState?.("denied"); }
      else if (e.error === "audio-capture") { on = false; onState?.("nomic"); }
      else if (e.error !== "no-speech" && e.error !== "aborted") fails++;
    };
    rec.onend = () => {
      if (!on) return onState?.("off");
      if (fails > 5) { on = false; return onState?.("error"); }
      clearTimeout(restartT); restartT = setTimeout(() => { if (on) try { rec.start(); } catch { /* already started */ } }, fails ? 800 : 150);
    };
    try { rec.start(); } catch { onState?.("error"); }
  };
  make();
  return { stop() { on = false; clearTimeout(restartT); try { rec?.abort(); } catch { /* ignore */ } onState?.("off"); } };
}
