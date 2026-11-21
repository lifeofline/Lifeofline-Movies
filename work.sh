#!/bin/bash
# work.sh JOB_BRANCH OUT_BRANCH : render every episode in JOB_BRANCH (masters split in parts) and push the finished parts to OUT_BRANCH.
# Last line printed = manifest JSON for the upload job.
set -u
JOB=$1; OUTB=$2
R=https://github.com/lifeofline/Lifeofline-Movies
W=$HOME/gzw; rm -rf $W; mkdir -p $W; cd $W
git clone -q --depth 1 -b tmp-pipeline $R pipe || exit 1
git clone -q --depth 1 -b $JOB $R job || exit 1
export GZ_SRC=$W/src GZ_FONTS=$W/pipe/fonts
mkdir -p src
( cd job; find . -name '*.mp4.p??' | sed 's/\.p[0-9][0-9]$//' | sort -u | while read f; do mkdir -p "$W/src/$(dirname "$f")"; cat "$f".p?? > "$W/src/$f"; done )
cd pipe
ids=$(cat ../job/ids.txt)
ok=()
for id in $ids; do
  python3 prep.py $id > log_$id.txt 2>&1
  if ! grep -q '^LETTER' log_$id.txt; then python3 tri2.py $id >> log_$id.txt 2>&1 || { echo "FAIL $id"; tail -5 log_$id.txt; continue; }; fi
  ( cd out/$id && for k in w t; do [ -f $k.mp4 ] && split -b 90m -d -a 2 $k.mp4 $k.mp4.p; done; rm -f w.mp4 t.mp4 )
  ok+=($id); echo "OK $id"
done
mkdir -p $W/res; cd $W/res; git init -q; git checkout -q -b $OUTB
for id in "${ok[@]}"; do mkdir -p $id; cp $W/pipe/out/$id/meta.json $id/; cp $W/pipe/out/$id/*.mp4.p?? $id/; done
git add . && git -c user.name=Lifeofline -c user.email=movies@lifeofline.com commit -qm "render $OUTB" && git push -q -f $R $OUTB 2>&1 | tail -2
python3 -c "
import os,json,sys
ids=sys.argv[2:]; print(json.dumps({'branch':sys.argv[1],'eps':[{'id':i,'w':sorted(f for f in os.listdir(i) if f.startswith('w.mp4.p')),'t':sorted(f for f in os.listdir(i) if f.startswith('t.mp4.p'))} for i in ids]}))" $OUTB "${ok[@]}"
