"""Exhaustive vowel-slip check of voice files against their script.
usage: python detect.py MODEL_DIR AUDIO_DIR TEXTS_JSON OUT_DIR rel1.mp3 rel2.mp3 ...
TEXTS_JSON: {rel: [text, "t1,t2,..." centiseconds per word]}
Writes OUT_DIR/<basename>.det.json = [[word_idx, t, word, variant, delta_audio, delta_prior], ...]"""
import sys, os, json, re, time, unicodedata, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import Scorer, clean
from run_asr import load

RULES = [('ि', 'ु'), ('ि', ''), ('ी', 'ू'), ('ौं', 'ू'), ('ौ', 'ू'), ('ौ', 'ो'), ('ू', 'ो'), ('े', 'ी'), ('ै', 'े'), ('ग़', 'ग'), ('ख़', 'ख'), ('ज़', 'ज'), ('ु', ''), ('थ', 'त'), ('ा', 'ौ'), ('य', 'ेय')]
SHORT = {'े', 'ा'}
TAG = re.compile(r'\[[^\]]*\]')

def variants(w):
    core = re.sub(r'[^ऀ-ॿ]', '', unicodedata.normalize('NFD', w))
    if len(core) < 2: return []
    out = set()
    for a, b in RULES:
        for m in re.finditer(a, core):
            if a in SHORT and len(core) > 4: continue
            v = core[:m.start()] + b + core[m.end():]
            if v != core: out.add(v)
    return sorted(out)

def windows(words, st, maxdur=18.0):
    """split word indices into windows of <= maxdur s, cutting at the largest gaps"""
    idx = [i for i, w in enumerate(words) if not TAG.fullmatch(w)]
    out, cur = [], []
    for i in idx:
        if cur and st[i] - st[cur[0]] > maxdur:
            # cut at largest gap in the last half
            half = cur[len(cur) // 2:]
            gaps = [(st[half[k + 1]] - st[half[k]], k) for k in range(len(half) - 1)] or [(0, len(half) - 1)]
            k = max(gaps)[1] + len(cur) // 2
            out.append(cur[:k + 1]); cur = cur[k + 1:]
        cur.append(i)
    if cur: out.append(cur)
    return out

def main():
    md, ad, tj, od = sys.argv[1:5]
    os.makedirs(od, exist_ok=True)
    texts = json.load(open(tj, encoding='utf-8'))
    S = Scorer(md)
    hs = S.enc_audio(np.zeros(16000, np.float32))
    for rel in sys.argv[5:]:
        dst = os.path.join(od, os.path.basename(rel) + '.det.json')
        if os.path.exists(dst) or rel not in texts: continue
        t0 = time.time()
        text, times = texts[rel]
        words = unicodedata.normalize('NFD', text).split(); st = [int(x) / 100 for x in times.split(',')]
        x = load(os.path.join(ad, rel)); dur = len(x) / 16000
        res = []
        for win in windows(words, st):
            a = st[win[0]] - 0.15
            nxt = win[-1] + 1
            b = (st[nxt] - 0.05) if nxt < len(st) else dur
            b = min(b, st[win[-1]] + 3.0, a + 29.5)
            h = S.enc_audio(x[int(max(0, a) * 16000): int(b * 16000)])
            wl = [words[i] for i in win]
            base = clean(' '.join(wl))
            l0 = S.logp(h, base); p0 = None
            for k, i in enumerate(win):
                for v in variants(words[i]):
                    core = re.sub(r'[^ऀ-ॿ]', '', words[i])
                    var = clean(' '.join(wl[:k] + [words[i].replace(core, v)] + wl[k + 1:]))
                    l1 = S.logp(h, var)
                    if l1 - l0 > 0.5:  # only pay for the prior when the audio delta is interesting
                        if p0 is None: p0 = S.logp(hs, base)
                        pr = S.logp(hs, var) - p0
                    else:
                        pr = None
                    res.append([i, st[i], words[i], v, round(l1 - l0, 2), None if pr is None else round(pr, 2)])
        json.dump(res, open(dst, 'w'), ensure_ascii=False)
        print(rel, round(dur), 's audio,', len(res), 'variants in', round(time.time() - t0), 's', flush=True)

if __name__ == '__main__':
    main()
