#!/bin/bash
# det_work.sh N : forced-choice vowel-slip check for the voice files in detjobs/N.txt, push results to branch tmp-det-res-N.
set -u
N=$1
R=https://github.com/lifeofline/Lifeofline-Movies
W=$HOME/detw; rm -rf $W; mkdir -p $W; cd $W
git clone -q --depth 1 -b tmp-det $R a || exit 1
cd a
for f in wm/*.onnx.p00; do b=${f%.p00}; cat $b.p?? > $b; rm -f $b.p??; done
python3 -c "import onnxruntime" 2>/dev/null || pip install -q onnxruntime numpy --break-system-packages
mapfile -t FILES < detjobs/$N.txt
python3 detect.py wm audio texts_by_file.json out "${FILES[@]}"
cd out && git init -q && git checkout -q -b tmp-det-res-$N && git add . && \
  git -c user.name=Lifeofline -c user.email=movies@lifeofline.com commit -qm "det $N" && git push -q -f $R tmp-det-res-$N 2>&1 | tail -2
echo "DONE $N $(ls | wc -l) files"
