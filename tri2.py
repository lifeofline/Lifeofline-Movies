# Trilingual captions (Devanagari + Urdu + English) on finished Ghalib Zinda Hai episodes, both formats.
# usage: python3 tri.py episode.json   (episode.json: {wide, tall, out_wide, out_tall, title_ur, shers:[{t,e,ur:[l1,l2]}], ov_dir})
# Pass 1 reads the 16:9 master to learn, frame by frame, when each caption line is on screen (clean dark backgrounds).
# Pass 2 draws Urdu under the Devanagari in both formats, moving the English down to make room.
import sys, json, subprocess, numpy as np
from PIL import Image, ImageFilter
import os, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skel import sk_d, sk_u
FPS = 25; HERE = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(f'{HERE}/rekhta_eps.json')); MT = json.load(open(f'{HERE}/matched.json')); FO = json.load(open(f'{HERE}/folders.json'))
DOC = sys.argv[1]; E = next(e for e in J['eps'] if e['id'] == DOC)
folder = json.load(open(f'{HERE}/docfolder.json'))[DOC]
SRC = os.environ.get('GZ_SRC', '/mnt/user-data/uploads/Ghalib Zinda Hai/Episodes') + '/' + folder + '/'
OUT = f'{HERE}/out/{DOC}'; os.makedirs(OUT + '/ov', exist_ok=True)
shers = [{'t': float(s['t']), 'e': float(s['e']), 'ur': m['ur'], 'text': s['text'], 'i': m['i']} for s, m in zip(E['shers'], MT[DOC]) if m and m['score'] >= 0.45]
EP = {'wide': SRC + FO[folder]['w'][0], 'tall': SRC + FO[folder]['t'][0], 'out_wide': OUT + '/w.mp4', 'out_tall': OUT + '/t.mp4', 'ov_dir': OUT + '/ov', 'shers': shers}
def ov(name, maxh):
    im = Image.open(f"{EP['ov_dir']}/{name}.png").convert('RGBA')
    a = np.asarray(im)[..., 3]; r = np.where(a.max(1) > 8)[0]; c = np.where(a.max(0) > 8)[0]
    im = im.crop((c.min() - 4, r.min() - 4, c.max() + 5, r.max() + 5))
    if im.height > maxh: im = im.resize((round(im.width * maxh / im.height), maxh), Image.LANCZOS)
    x = np.asarray(im).astype(np.float32) / 255
    return x[..., :3] * 255, x[..., 3:]
def fill(f, x0, x1, y0, y1):
    top = f[y0-3:y0, x0:x1].astype(np.float32).mean(0); bot = f[y1:y1+3, x0:x1].astype(np.float32).mean(0)
    w = np.linspace(0, 1, y1 - y0, dtype=np.float32)[:, None, None]
    return top[None] * (1 - w) + bot[None] * w
def raw(g, x0, x1, y0, y1):  # brightest text above the local background
    top = g[y0-7:y0-4, x0:x1].mean(0); bot = g[y1+4:y1+7, x0:x1].mean(0)
    w = np.linspace(0, 1, y1 - y0)[:, None]; return float(np.percentile(g[y0:y1, x0:x1] - (top * (1 - w) + bot * w), 99.7))
def paste(out, o, cx, cy, a):
    if a <= 0.003: return
    rgb, oa = o; h, w = oa.shape[:2]; x = round(cx - w / 2); y = round(cy - h / 2)
    k = oa * a; out[y:y+h, x:x+w] = out[y:y+h, x:x+w] * (1 - k) + rgb * k
def move(f, out, x0, x1, y0, y1, dy, g, oldfill=None):
    """move the letters (not the picture) in rows y0..y1 by dy, blended in by g (0..1)"""
    if g <= 0.003: return
    old = fill(f, x0, x1, y0, y1) if oldfill is None else oldfill
    txt = f[y0:y1, x0:x1].astype(np.float32) - old
    m = (txt.mean(2) > 22).astype(np.float32)
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)[..., None] / 255
    txt = np.maximum(txt * m, -40)
    src = out[y0:y1, x0:x1].copy(); out[y0:y1, x0:x1] = src * (1 - g) + old * g
    d0, d1 = max(y0 + dy, 0), min(y1 + dy, out.shape[0]); seg = out[d0:d1, x0:x1].copy()
    out[d0:d1, x0:x1] = seg * (1 - g) + np.clip(seg + txt[d0 - y0 - dy:d1 - y0 - dy], 0, 255) * g
def dec(path, W, H, fmt='rgb24'):
    n = W * H * (3 if fmt == 'rgb24' else 1)
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', fmt, '-'], stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(n)
        if len(b) < n: return
        yield np.frombuffer(b, np.uint8).reshape((H, W, 3) if fmt == 'rgb24' else (H, W))
# ---- pass 1: visibility per frame from the 16:9 master
M = []
for g in dec(EP['wide'], 1920, 1080, 'gray'):
    g = g.astype(np.float32)
    panel = float(np.median(g[180:300, 1500:1800])) < 45 and float(np.median(g[180:300, 1000:1200])) < 45
    M.append([panel, raw(g, 900, 1800, 389, 478), raw(g, 480, 1440, 762, 831), raw(g, 500, 1420, 842, 918), raw(g, 270, 1650, 940, 975),
              raw(g, 866, 1831, 395, 453), raw(g, 866, 1831, 490, 554), raw(g, 866, 1831, 634, 721),
              raw(g, 696, 1222, 306, 383), float(np.median(g[200:900, 100:700])) < 30])
M = np.array(M, np.float32); n = len(M); T = np.arange(n) / FPS
sher_on = np.zeros(n, bool)
for s in EP['shers']: sher_on |= (T >= s['t'] - 1.5) & (T <= s['e'] + 1.5)
def norm(col, mask, pc=90, floor=40):
    v = M[:, col]; ref = np.percentile(v[mask], pc) if mask.any() else 200
    return np.clip((v - 12) / max(ref - 12, floor), 0, 1) * mask
panel = M[:, 0] > 0.5
title_mask = panel & ~sher_on & ~(M[:, 9] > 0.5)   # not on the end credits
pm, qm = sher_on & ~panel, sher_on & panel   # shers over paintings / shers beside the lip-synced portrait (dark panel)
last_e = max(x['e'] for x in EP['shers']) if EP['shers'] else 0
cred_mask = (M[:, 9] > 0.5) & (T > last_e + 2) & ~panel
old_cred = cred_mask.any() and np.percentile(M[cred_mask, 8], 95) > 120   # older episodes show the Hindi title in the credits
cred_mask[:] = False   # credits left as they are
A = {'cred': norm(8, cred_mask, 95, 120), 'title': norm(1, title_mask, 99, 120), 'd1': norm(2, pm), 'd2': norm(3, pm), 'en': norm(4, pm), 'q1': norm(5, qm), 'q2': norm(6, qm), 'qe': norm(7, qm)}
env = np.zeros(n, np.float32)  # each sher's on-screen window, with short fades; captions never outlive it
for s_ in EP['shers']: env = np.maximum(env, np.clip(np.minimum(T - (s_['t'] - 0.6), (s_['e'] + 0.6) - T) / 0.5, 0, 1))
for k in A:
    A[k] = np.convolve(A[k], np.ones(3) / 3, 'same')  # steady
    if k != 'title': A[k] = np.minimum(A[k], env) * (A[k] > 0.18)
cur = np.full(n, -1)
for i, s in enumerate(EP['shers']): cur[(T >= s['t'] - 3)] = i
def words_on_screen():
    k = int(np.argmax(np.where(title_mask, M[:, 1], -1)))
    b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(k / FPS), '-i', EP['wide'], '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    g = np.frombuffer(b, np.uint8).reshape(1080, 1920)[372:490, 860:1840] > 150
    cols = g.any(0); runs, gap, inrun = 0, 99, False
    for c in cols:
        if c:
            if not inrun and gap >= 9: runs += 1
            inrun, gap = True, 0
        else: inrun = False; gap += 1
    return runs
def name_sk(nm):
    nm = nm.lower()
    for a, b in [('kh', 'k'), ('gh', 'g'), ('sh', 's'), ('ch', 'c'), ('th', 't'), ('dh', 'd'), ('bh', 'b'), ('ph', 'f'), ('j', 'z'), ('w', 'v'), ('ee', 'i')]: nm = nm.replace(a, b)
    return re.sub('[^bcdfgklmnpqrstvyz]', '', nm)
import difflib
ns = name_sk(E['name'])
def win(ns, line):  # best match of the name anywhere in the line, start of line slightly preferred
    sk = sk_d(line); L = len(ns)
    return max([difflib.SequenceMatcher(None, ns, sk[i:i + L + 2]).ratio() - 0.15 * (i > 0) for i in range(0, max(1, len(sk) - L + 1))] or [0])
lat = lambda t: re.sub('[^a-z]', '', t.lower().replace('ee', 'i').replace('oo', 'u').replace('w', 'v'))
def winr(n, l): return max([difflib.SequenceMatcher(None, n, l[i:i + len(n)]).ratio() - 0.15 * (i > 0) for i in range(0, max(1, len(l) - len(n) + 1), 2)] or [0])
RO = {round(float(s['t']), 2): m.get('ro') for s, m in zip(E['shers'], MT[DOC]) if m}
cands = [(winr(lat(E['name']), lat(RO[round(x['t'], 2)][j])) + 1, x, j) for x in EP['shers'] if RO.get(round(x['t'], 2)) for j in (0, 1)]
if not cands or max(c[0] for c in cands) < 1.5:   # no good Roman match: compare consonants of the Hindi line
    cands = [(win(ns, x['text'].split('\n')[j]), x, j) for x in EP['shers'] for j in (0, 1)]
_, matla, mj = max(cands, key=lambda c: c[0])   # the line the episode is named after
dv = matla['text'].split('\n')[mj].split(); uw = matla['ur'][mj].split()
# ---- title lines wider than the screen (older episodes): re-set them so nothing is cut off
FD = os.environ.get('GZ_FONTS', HERE + '/../fnt/gf/ofl') + '/'
from PIL import ImageFont, ImageDraw
def grab(path, k, W, H):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(k / FPS), '-i', path, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return np.frombuffer(b, np.uint8).reshape(H, W, 3)
def ink(f, y0, y1, x0, x1, kind):
    c = f[y0:y1, x0:x1].astype(int)
    m = (c[..., 0] > 200) & (c[..., 1] > 140) & (c[..., 2] < 110) & (c[..., 0] - c[..., 2] > 100) if kind == 'gold' else c.min(2) > 205
    if m.sum() < 200: return None
    ys, xs = np.where(m); return [xs.min() + x0, xs.max() + x0, ys.min() + y0, ys.max() + y0]
w = words_on_screen() if title_mask.any() else len(dv)
if title_mask.any():
    kt = int(np.argmax(np.where(title_mask, M[:, 1], -1)))
    fw, ft = grab(EP['wide'], kt, 1920, 1080), grab(EP['tall'], kt, 1080, 1920)
    rr = ink(fw, 340, 488, 775, 1920, 'white')
    if rr and (rr[1] >= 1893 or rr[0] <= 790):   # wide title cut off: count the words on the phone version instead
        cols = (ft[1320:1460].min(2) > 150).any(0); runs, gap, inrun = 0, 99, False
        for c in cols:
            if c:
                if not inrun and gap >= 9: runs += 1
                inrun, gap = True, 0
            else: inrun = False; gap += 1
        w = runs
if w >= len(dv) or w <= 0: title_ur = matla['ur'][mj]
else:
    f = len(sk_d(' '.join(dv[:w]))) / max(1, len(sk_d(' '.join(dv))))
    k = min(range(1, len(uw) + 1), key=lambda j: abs(len(sk_u(' '.join(uw[:j]))) / max(1, len(sk_u(' '.join(uw)))) - f))
    title_ur = ' '.join(uw[:k])
jobs = [{'name': 'title', 'text': title_ur, 'size': 84, 'maxw': 900, 'color': '#fcf3ee', 'shadow': '0 3px 10px rgba(0,0,0,.7)'},
        {'name': 'cred', 'text': title_ur, 'size': 50, 'maxw': 540, 'color': '#fbf6f2', 'shadow': 'none'}]
for i, x in enumerate(EP['shers']):
    for j in (0, 1): jobs.append({'name': f's{i}_{j+1}', 'text': x['ur'][j], 'size': 44, 'maxw': 980})
json.dump(jobs, open(OUT + '/jobs.json', 'w'), ensure_ascii=False)
subprocess.run(['node', f'{HERE}/ovr.js', OUT + '/jobs.json', EP['ov_dir']], check=True)
OV = {'title': ov('title', 104), 'cred': ov('cred', 72)}
for i in range(len(EP['shers'])):
    for j in (1, 2): OV[f'w{i}_{j}'] = ov(f's{i}_{j}', 72); OV[f'q{i}_{j}'] = ov(f's{i}_{j}', 88); OV[f't{i}_{j}'] = ov(f's{i}_{j}', 80)

def setline(text, kind, ink_h, maxw):
    if kind == 'gold':
        F = lambda z: (lambda f: (f.set_variation_by_axes([600]), f)[1])(ImageFont.truetype(FD + 'ebgaramond/EBGaramond[wght].ttf', z))
        col = (248, 182, 69, 255)
    else:
        F = lambda z: ImageFont.truetype(FD + 'martel/Martel-Bold.ttf', z, layout_engine=ImageFont.Layout.RAQM); col = (251, 242, 230, 255)
    f = F(100); b = f.getbbox(text); z = 100 * ink_h / (b[3] - b[1]); f = F(round(z)); b = f.getbbox(text)
    if b[2] - b[0] > maxw: z *= maxw / (b[2] - b[0]); f = F(round(z)); b = f.getbbox(text)
    W, H = b[2] - b[0] + 40, b[3] - b[1] + 40
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(im).text((20 - b[0], 20 - b[1]), text, font=f, fill=col)
    a = np.asarray(im)[..., 3]
    sh = Image.fromarray(a).transform((W, H), Image.AFFINE, (1, 0, -3, 0, 1, -4)).filter(ImageFilter.GaussianBlur(3))
    s = np.asarray(sh).astype(np.float32)[..., None] / 255 * 0.8
    x = np.asarray(im).astype(np.float32) / 255; ta = x[..., 3:]
    rgb = x[..., :3] * ta * 255 + np.zeros(3) * s * (1 - ta); al = ta + s * (1 - ta)
    rgb = np.where(al > 0, rgb / np.maximum(al, 1e-6), 0)
    return rgb, al
k_seed = [7]
def erase(f, out, x0, x1, y0, y1, a, patch=None, band=False):
    if a <= 0.003: return
    bg = fill(f, x0, x1, y0, y1)
    if band:
        e = np.minimum(np.arange(y1 - y0) + 1, np.arange(y1 - y0)[::-1] + 1)
        m = np.clip(e / 10, 0, 1).astype(np.float32)[:, None, None] * np.ones((1, x1 - x0, 1), np.float32)
    else:
        d = np.abs(f[y0:y1, x0:x1].astype(np.float32) - bg).mean(2) > 7
        m = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(4))).astype(np.float32)[..., None] / 255
    if patch is not None:   # over the portrait: the same moment of the phone version, which has no letters there
        px0, px1, pimg = patch; bg[:, px0 - x0:px1 - x0] = pimg.astype(np.float32)
    m = m * a
    out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - m) + bg * m
TF = {'w': {}, 't': {}}
if title_mask.any():
    dvt = ' '.join(dv[:w]) if 0 < w < len(dv) else ' '.join(dv)
    r = ink(fw, 490, 600, 775, 1920, 'gold')
    if r and (r[1] >= 1893 or r[0] <= 790): TF['w']['ro'] = (r, setline(E['name'], 'gold', r[3] - r[2], 1030))
    r = ink(fw, 340, 488, 775, 1920, 'white')
    if r and (r[1] >= 1893 or r[0] <= 790): TF['w']['dv'] = (r, setline(dvt, 'white', r[3] - r[2], 1030))
    if TF['w']:
        rs = [v[0] for v in TF['w'].values()]; b0, b1 = min(x[2] for x in rs) - 14, max(x[3] for x in rs) + 16
        import cv2
        wp, tp = fw, ft
        o = cv2.ORB_create(4000); g1 = cv2.cvtColor(wp[:, 145:762], cv2.COLOR_RGB2GRAY); g2 = cv2.cvtColor(tp[:1300], cv2.COLOR_RGB2GRAY)
        q1, d1 = o.detectAndCompute(g1, None); q2, d2 = o.detectAndCompute(g2, None)
        mt = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(d1, d2) if d1 is not None and d2 is not None else []
        Aff, inl = (None, None) if len(mt) < 10 else cv2.estimateAffinePartial2D(np.float32([q2[x.trainIdx].pt for x in mt]), np.float32([q1[x.queryIdx].pt for x in mt]), ransacReprojThreshold=3)
        if Aff is None or inl.sum() < 40 or abs(Aff[0, 0] - 0.5625) > 0.03: Aff = np.float32([[0.5625, 0, 5.5], [0, 0.5625, 0]])
        Aff = Aff.copy(); Aff[0, 2] += 145 - 300; Aff[1, 2] -= b0   # into band coordinates, x from 300
        ref = cv2.warpAffine(tp, Aff, (458, b1 - b0)).astype(np.float32); cur_ = wp[b0:b1, 300:758].astype(np.float32)
        ok = (np.abs(cur_ - ref).max(2) < 40)[..., None]   # compare away from the letters
        gain = ((cur_ * ok).reshape(-1, 3).sum(0) + 1) / ((ref * ok).reshape(-1, 3).sum(0) + 1)
        kk = np.where(title_mask & (A['title'] > 0.003))[0]; TP = {}
        pr = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', str(kk[0] / FPS), '-i', EP['tall'], '-frames:v', str(kk[-1] - kk[0] + 1), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        for j in range(kk[0], kk[-1] + 1):
            bb = pr.stdout.read(1080 * 1920 * 3)
            if len(bb) < 1080 * 1920 * 3: break
            if title_mask[j] and A['title'][j] > 0.003: TP[j] = np.clip(cv2.warpAffine(np.frombuffer(bb, np.uint8).reshape(1920, 1080, 3), Aff, (458, b1 - b0)).astype(np.float32) * gain, 0, 255).astype(np.uint8)
        pr.stdout.close(); pr.wait()
        TF['w']['band'] = (b0, b1, TP)
    r = ink(ft, 1462, 1570, 0, 1080, 'gold')
    if r and (r[0] <= 6 or r[1] >= 1073): TF['t']['ro'] = (r, setline(E['name'], 'gold', r[3] - r[2], 990))
    r = ink(ft, 1320, 1460, 0, 1080, 'white')
    if r and (r[0] <= 6 or r[1] >= 1073): TF['t']['dv'] = (r, setline(dvt, 'white', r[3] - r[2], 990))
print('title fix', {k: [x for x in v if x != 'band'] for k, v in TF.items()})
class Band:
    """rows y0.. of a frame as float, addressed with full-frame coordinates"""
    def __init__(s, f, y0): s.y0 = y0; s.a = f[y0:].astype(np.float32); s.shape = f.shape
    def __getitem__(s, k): return s.a[s._k(k)]
    def __setitem__(s, k, v): s.a[s._k(k)] = v
    def _k(s, k):
        if isinstance(k, tuple): return (slice(k[0].start - s.y0, k[0].stop - s.y0),) + k[1:]
        return slice(k.start - s.y0, k.stop - s.y0)
class FB:  # the source frame, same addressing
    def __init__(s, f, y0): s.f = f; s.y0 = y0
    def __getitem__(s, k): return s.f[k]
def busy_w(k): return cred_mask[k] and A['cred'][k] > 0.003 or title_mask[k] and A['title'][k] > 0.003 or (cur[k] >= 0 and max(A['d1'][k], A['d2'][k], A['en'][k], A['q1'][k], A['q2'][k], A['qe'][k]) > 0.003)
def frame_w(f, k):
    if not busy_w(k): return f
    y0 = 280 if cred_mask[k] else 330; full = f.copy(); out = Band(f, y0)
    _frame_w(f, out, k); full[y0:] = out.a.clip(0, 255).astype(np.uint8); return full
def frame_t(f, k):
    if not busy_w(k): return f
    if cred_mask[k]:
        full = f.copy(); out = Band(f, 700); a = A['cred'][k]
        move(f, out, 100, 980, 838, 900, 80, 1.0); paste(out, OV['cred'], 540, 872, a)
        full[700:] = out.a.clip(0, 255).astype(np.uint8); return full
    full = f.copy(); y0 = 1300; out = Band(f, y0)
    _frame_t(f, out, k); full[y0:] = out.a.clip(0, 255).astype(np.uint8); return full
def _frame_w(f, out, k):
    if cred_mask[k]:
        a = A['cred'][k]; move(f, out, 600, 1320, 388, 444, 78, 1.0); paste(out, OV['cred'], 960, 428, a); return
    if title_mask[k]:
        a = A['title'][k]; T = TF['w']; ys = 496
        if 'band' in T:
            b0, b1, TPk = T['band']; erase(f, out, 300, 1920, b0, b1, a, (300, 758, TPk[k]) if k in TPk else None, True)
            if 'ro' in T: ys = b1
        if 'dv' in T: r, o = T['dv']; paste(out, o, 1349, (r[2] + r[3]) / 2, a)
        move(f, out, 820, 1880, ys, 772, 120, a); paste(out, OV['title'], 1349, 553, a)
        if 'ro' in T: r, o = T['ro']; paste(out, o, 1349, (r[2] + r[3]) / 2 + 120, a)
    elif cur[k] >= 0 and panel[k]:   # beside the portrait: same layout as the first season
        a1, a2, ae = A['q1'][k], A['q2'][k], A['qe'][k]; i = cur[k]
        move(f, out, 820, 1880, 576, 734, 196, max(a1, a2, ae))
        paste(out, OV[f'q{i}_1'], 1349, 618, a1); paste(out, OV[f'q{i}_2'], 1349, 714, a2)
    elif cur[k] >= 0:
        a1, a2, ae = A['d1'][k], A['d2'][k], A['en'][k]; g = max(a1, a2, ae); i = cur[k]
        if g > 0.003:
            # extend the dark band upward so the raised Hindi lines stay readable over the painting
            ramp = np.clip((np.arange(540, 760) - 540) / 160, 0, 1)[:, None, None]
            out[540:760] *= (1 - 0.6 * g * ramp)
            move(f, out, 0, 1920, 705, 925, -100, g); move(f, out, 0, 1920, 930, 985, 55, g)
            paste(out, OV[f'w{i}_1'], 960, 862, a1); paste(out, OV[f'w{i}_2'], 960, 938, a2)
def _frame_t(f, out, k):
    if cred_mask[k]: return
    if title_mask[k]:
        a = A['title'][k]; T = TF['t']; ys = 1466
        if T:
            rs = [v[0] for v in T.values()]; b0, b1 = min(x[2] for x in rs) - 8, max(x[3] for x in rs) + 10
            erase(f, out, 0, 1080, b0, b1, a)
            if 'ro' in T: ys = b1
        if 'dv' in T: r, o = T['dv']; paste(out, o, 540, (r[2] + r[3]) / 2, a)
        move(f, out, 0, 1080, ys, 1745, 120, a); paste(out, OV['title'], 540, 1527, a)
        if 'ro' in T: r, o = T['ro']; paste(out, o, 540, (r[2] + r[3]) / 2 + 120, a)
    elif cur[k] >= 0:
        q = panel[k]; a1, a2, ae = (A['q1'][k], A['q2'][k], A['qe'][k]) if q else (A['d1'][k], A['d2'][k], A['en'][k]); i = cur[k]
        move(f, out, 0, 1080, 1545, 1668, 178, ae)
        paste(out, OV[f't{i}_1'], 540, 1588, a1); paste(out, OV[f't{i}_2'], 540, 1678, a2)
def run(src, dst, W, H, fn, only=None):
    if only is not None:
        for k in only:
            b = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(k / FPS), '-i', src, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
            Image.fromarray(fn(np.frombuffer(b, np.uint8).reshape(H, W, 3), k)).save(f'{dst}_{k}.png')
        return
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', src,
        '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
    for k, f in enumerate(dec(src, W, H)): enc.stdin.write(fn(f, min(k, n - 1)).tobytes())
    enc.stdin.close(); enc.wait()
if len(sys.argv) > 2:  # preview frames at given seconds
    ks = [round(float(x) * FPS) for x in sys.argv[2].split(',')]; os.chdir(OUT)
    run(EP['wide'], 'pw', 1920, 1080, frame_w, ks); run(EP['tall'], 'pt', 1080, 1920, frame_t, ks)
    print('title', repr(title_ur), 'old credits', bool(old_cred), 'shers', len(EP['shers']))
    print({k: (bool(panel[k]), bool(title_mask[k]), int(cur[k]), *[round(float(A[x][k]), 2) for x in ('d1','d2','en','q1','q2','qe','title')]) for k in ks})
else:
    run(EP['wide'], EP['out_wide'], 1920, 1080, frame_w); run(EP['tall'], EP['out_tall'], 1080, 1920, frame_t)
    json.dump({'doc': DOC, 'folder': folder, 'dur': round(n / FPS), 'title_ur': title_ur, 'shers': [{'ur': '\n'.join(m['ur']), 'ro': '\n'.join(m['ro']) if m['ro'] else ''} if m else None for m in MT[DOC]]},
              open(OUT + '/meta.json', 'w'), ensure_ascii=False)
    print('done', DOC, n)
