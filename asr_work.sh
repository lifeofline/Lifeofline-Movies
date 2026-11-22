#!/bin/bash
# asr_work.sh N : transcribe the voice files listed in jobs/N.txt with the free Whisper model, push results to branch tmp-asr-res-N.
set -u
N=$1
R=https://github.com/lifeofline/Lifeofline-Movies
W=$HOME/asrw; rm -rf $W; mkdir -p $W; cd $W
git clone -q --depth 1 -b tmp-asr $R a || exit 1
cd a
for f in wm/*.onnx.p00; do b=${f%.p00}; cat $b.p?? > $b; rm -f $b.p??; done
python3 -c "import onnxruntime" 2>/dev/null || pip install -q onnxruntime numpy --break-system-packages
mapfile -t FILES < jobs/$N.txt
python3 run_asr.py wm audio out "${FILES[@]}"
cd out && git init -q && git checkout -q -b tmp-asr-res-$N && git add . && \
  git -c user.name=Lifeofline -c user.email=movies@lifeofline.com commit -qm "asr $N" && git push -q -f $R tmp-asr-res-$N 2>&1 | tail -2
echo "DONE $N $(ls | wc -l) files"
