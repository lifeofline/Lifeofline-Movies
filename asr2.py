"""Whisper-small ONNX with KV cache (decoder_with_past) — faster greedy decoding.
Falls back to the no-past decoder when the with-past model is missing."""
import os, json, numpy as np, onnxruntime as ort
from asr import log_mel, _bytes_unicode

class ASR2:
    def __init__(self, d, lang="hi"):
        so = ort.SessionOptions(); so.intra_op_num_threads = os.cpu_count() or 2
        self.enc = ort.InferenceSession(os.path.join(d, "encoder_model_quantized.onnx"), so)
        self.dec = ort.InferenceSession(os.path.join(d, "decoder_model_quantized.onnx"), so)
        p = os.path.join(d, "decoder_with_past_model_quantized.onnx")
        self.decp = ort.InferenceSession(p, so) if os.path.exists(p) else None
        tok = json.load(open(os.path.join(d, "whisper_small_tokenizer.json"), encoding="utf-8"))
        vocab = tok["model"]["vocab"]
        for a in tok.get("added_tokens", []): vocab[a["content"]] = a["id"]
        self.inv = {v: k for k, v in vocab.items()}; self.b2 = _bytes_unicode()
        self.special = {a["id"] for a in tok.get("added_tokens", [])}
        self.eot = vocab["<|endoftext|>"]
        self.prompt = [vocab["<|startoftranscript|>"], vocab[f"<|{lang}|>"], vocab["<|transcribe|>"], vocab["<|notimestamps|>"]]
        self.dec_out = [o.name for o in self.dec.get_outputs()]
        if self.decp:
            self.p_in = [i.name for i in self.decp.get_inputs()]
            self.p_out = [o.name for o in self.decp.get_outputs()]

    def text(self, ids):
        s = "".join(self.inv[i] for i in ids if i not in self.special)
        return bytes(self.b2.get(c, 32) for c in s).decode("utf-8", "replace").strip()

    def transcribe(self, pcm, max_tokens=200):
        h = self.enc.run(None, {"input_features": log_mel(pcm)})[0]
        ids = list(self.prompt)
        outs = self.dec.run(None, {"input_ids": np.array([ids], np.int64), "encoder_hidden_states": h})
        res = dict(zip(self.dec_out, outs))
        nxt = int(np.argmax(res["logits"][0, -1]))
        if not self.decp:  # slow path
            from asr import ASR
            raise RuntimeError("with-past model missing")
        past = {k.replace("present", "past_key_values"): v for k, v in res.items() if k.startswith("present")}
        out = []
        for _ in range(max_tokens):
            if nxt == self.eot: break
            out.append(nxt)
            if len(out) > 12 and len(set(out[-8:])) <= 2: break
            feed = {"input_ids": np.array([[nxt]], np.int64)}
            for n in self.p_in:
                if n.startswith("past_key_values"): feed[n] = past[n]
                elif n == "encoder_hidden_states": feed[n] = h
            r = dict(zip(self.p_out, self.decp.run(None, feed)))
            nxt = int(np.argmax(r["logits"][0, -1]))
            for k, v in r.items():
                if k.startswith("present") and ".decoder." in k:
                    past[k.replace("present", "past_key_values")] = v
        return self.text(out)
