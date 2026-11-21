# prep.py id        -> for letter episodes (no Urdu shers): copy the 16:9 master as w.mp4 + meta, print LETTER
# prep.py id --clean -> delete this episode's staged masters
import sys, json, os, re, shutil, subprocess
H = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(f'{H}/rekhta_eps.json')); MT = json.load(open(f'{H}/matched.json')); FO = json.load(open(f'{H}/folders.json'))
DOC = sys.argv[1]; E = next(e for e in J['eps'] if e['id'] == DOC)
folder = json.load(open(f'{H}/docfolder.json'))[DOC]
SRC = os.environ.get('GZ_SRC', '/mnt/user-data/uploads/Ghalib Zinda Hai/Episodes') + '/' + folder + '/'
OUT = f'{H}/out/{DOC}'; os.makedirs(OUT, exist_ok=True)
if len(sys.argv) > 2:
    shutil.rmtree(SRC, ignore_errors=True); print('cleaned', SRC); sys.exit()
if not any(m and m['score'] >= 0.45 for m in MT[DOC]):
    shutil.copy(SRC + FO[folder]['w'][0], OUT + '/w.mp4')
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT + '/w.mp4'], capture_output=True, text=True).stdout)
    json.dump({'doc': DOC, 'folder': folder, 'dur': round(d), 'shers': None, 'wideOnly': True}, open(OUT + '/meta.json', 'w'))
    print('LETTER', DOC)
