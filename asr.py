"""Whisper-small (ONNX, int8) speech-to-text for short clips. No internet needed.
Usage as module: from asr import ASR; a = ASR(model_dir); a.transcribe(pcm16k_float32) -> text
"""
import json, numpy as np, onnxruntime as ort, os

SR, NFFT, HOP, NMEL, NS = 16000, 400, 160, 80, 480000

def _mel_filters():
    def hz2mel(f):
        f = np.atleast_1d(np.asarray(f, float)); m = f / (200.0 / 3)
        log = f >= 1000.0
        m[log] = 15.0 + np.log(f[log] / 1000.0) / (np.log(6.4) / 27.0)
        return m
    def mel2hz(m):
        m = np.atleast_1d(np.asarray(m, float)); f = m * 200.0 / 3
        log = m >= 15.0
        f[log] = 1000.0 * np.exp((np.log(6.4) / 27.0) * (m[log] - 15.0))
        return f
    fft = np.linspace(0, SR / 2, NFFT // 2 + 1)
    mpts = mel2hz(np.linspace(hz2mel(0.0)[0], hz2mel(8000.0)[0], NMEL + 2))
    fd = np.diff(mpts); ramps = mpts[:, None] - fft[None, :]
    w = np.zeros((NMEL, NFFT // 2 + 1))
    for i in range(NMEL):
        lo = -ramps[i] / fd[i]; up = ramps[i + 2] / fd[i + 1]
        w[i] = np.maximum(0, np.minimum(lo, up))
    w *= (2.0 / (mpts[2:NMEL + 2] - mpts[:NMEL]))[:, None]
    return w.astype(np.float32)

MEL = _mel_filters()
WIN = np.hanning(NFFT + 1)[:-1].astype(np.float32)

def log_mel(x):
    x = np.pad(x.astype(np.float32), (0, max(0, NS - len(x))))[:NS]
    x = np.pad(x, (NFFT // 2, NFFT // 2), mode="reflect")
    n = 1 + (len(x) - NFFT) // HOP
    fr = np.lib.stride_tricks.as_strided(x, (n, NFFT), (x.strides[0] * HOP, x.strides[0]))
    spec = np.abs(np.fft.rfft(fr * WIN, axis=1)) ** 2
    spec = spec[:-1].T  # drop last frame -> 3000
    m = np.log10(np.maximum(MEL @ spec, 1e-10))
    m = np.maximum(m, m.max() - 8.0)
    return ((m + 4.0) / 4.0).astype(np.float32)[None]

def _bytes_unicode():
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + list(range(ord("®"), ord("ÿ") + 1))
    cs = bs[:]; n = 0
    for b in range(256):
        if b not in bs: bs.append(b); cs.append(256 + n); n += 1
    return {chr(c): b for b, c in zip(bs, cs)}

class ASR:
    def __init__(self, d, lang="hi"):
        so = ort.SessionOptions(); so.intra_op_num_threads = os.cpu_count() or 2
        self.enc = ort.InferenceSession(os.path.join(d, "encoder_model_quantized.onnx"), so)
        self.dec = ort.InferenceSession(os.path.join(d, "decoder_model_quantized.onnx"), so)
        tok = json.load(open(os.path.join(d, "whisper_small_tokenizer.json"), encoding="utf-8"))
        vocab = tok["model"]["vocab"]
        for a in tok.get("added_tokens", []): vocab[a["content"]] = a["id"]
        self.inv = {v: k for k, v in vocab.items()}
        self.b2 = _bytes_unicode()
        self.sot = vocab["<|startoftranscript|>"]; self.eot = vocab["<|endoftext|>"]
        self.prompt = [self.sot, vocab[f"<|{lang}|>"], vocab["<|transcribe|>"], vocab["<|notimestamps|>"]]
        self.special = {a["id"] for a in tok.get("added_tokens", [])}
        self.dec_inputs = [i.name for i in self.dec.get_inputs()]

    def text(self, ids):
        s = "".join(self.inv[i] for i in ids if i not in self.special)
        return bytes(self.b2.get(c, 32) for c in s).decode("utf-8", "replace").strip()

    def transcribe(self, pcm, max_tokens=60):
        h = self.enc.run(None, {"input_features": log_mel(pcm)})[0]
        ids = list(self.prompt)
        for _ in range(max_tokens):
            feed = {"input_ids": np.array([ids], dtype=np.int64), "encoder_hidden_states": h}
            logits = self.dec.run(None, {k: v for k, v in feed.items() if k in self.dec_inputs})[0]
            nxt = int(np.argmax(logits[0, -1]))
            if nxt == self.eot: break
            ids.append(nxt)
            if len(ids) > 8 and len(set(ids[-6:])) == 1: break
        return self.text(ids[len(self.prompt):])
