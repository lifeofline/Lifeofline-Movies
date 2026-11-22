"""Transcribe whole voice files in pause-bounded chunks (<=25 s).
usage: python run_asr.py MODEL_DIR AUDIO_DIR OUT_DIR file1.mp3 file2.mp3 ...
Writes OUT_DIR/<name>.json = [[start, end, text], ...]"""
import sys, os, json, subprocess, re, time, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asr2 import ASR2
from asr import ASR

def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)

def silences(p):
    o = subprocess.run(["ffmpeg", "-hide_banner", "-i", p, "-af", "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-"], capture_output=True, text=True).stderr
    s = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", o)]
    e = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", o)]
    return list(zip(s, e))

def chunks(dur, sil, maxlen=25.0):
    cuts = [(a + b) / 2 for a, b in sil]
    out, st = [], 0.0
    while st < dur - 0.3:
        lim = st + maxlen
        cand = [c for c in cuts if st + 3 < c <= lim]
        en = max(cand) if cand and lim < dur else min(dur, lim)
        out.append((st, en)); st = en
    return out

if __name__ == "__main__":
    md, ad, od = sys.argv[1:4]
    os.makedirs(od, exist_ok=True)
    a = ASR2(md) if os.path.exists(os.path.join(md, 'decoder_with_past_model_quantized.onnx')) else ASR(md)
    for f in sys.argv[4:]:
        dst = os.path.join(od, os.path.basename(f) + ".json")
        if os.path.exists(dst): continue
        p = os.path.join(ad, f)
        x = load(p); dur = len(x) / 16000
        res = []; t0 = time.time()
        for s, e in chunks(dur, silences(p)):
            seg = x[int(s * 16000): int(e * 16000)]
            res.append([round(s, 2), round(e, 2), a.transcribe(seg)])
        json.dump(res, open(dst, "w"), ensure_ascii=False)
        print(f, round(dur), "s audio in", round(time.time() - t0), "s", flush=True)
