"""Forced-choice check: does the audio sound more like the script word or like a slip variant?
Scores a short audio window against two texts with Whisper (teacher forcing) and returns log-prob difference."""
import json, os, re, numpy as np
from asr import ASR, log_mel, _bytes_unicode

class Scorer(ASR):
    def __init__(self, d):
        super().__init__(d)
        self.vocab = {v: k for k, v in self.inv.items()}
        self.ub = {b: c for c, b in self.b2.items()}  # byte -> unicode char
        self.maxlen = max(len(k) for k in self.vocab)

    def encode(self, text):
        s = ''.join(self.ub[b] for b in text.encode('utf-8'))
        ids, i = [], 0
        while i < len(s):
            for L in range(min(self.maxlen, len(s) - i), 0, -1):
                t = s[i:i + L]
                if t in self.vocab and self.vocab[t] not in self.special:
                    ids.append(self.vocab[t]); i += L; break
            else:
                i += 1
        return ids

    def enc_audio(self, pcm):
        return self.enc.run(None, {"input_features": log_mel(pcm)})[0]

    def logp(self, h, text):
        ids = self.prompt + self.encode(' ' + text.strip()) + [self.eot]
        lg = self.dec.run(None, {"input_ids": np.array([ids], np.int64), "encoder_hidden_states": h})[0][0]
        lg = lg - lg.max(-1, keepdims=True); lp = lg - np.log(np.exp(lg).sum(-1, keepdims=True))
        n = len(self.prompt)
        return float(sum(lp[k - 1, ids[k]] for k in range(n, len(ids))))

def clean(t):
    t = re.sub(r'\[[^\]]*\]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()
