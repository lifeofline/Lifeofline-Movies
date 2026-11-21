import re, unicodedata
DV = {'क':'k','ख':'k','ग':'g','घ':'g','च':'c','छ':'c','ज':'z','झ':'z','ट':'t','ठ':'t','ड':'d','ढ':'d','ण':'n','त':'t','थ':'t','द':'d','ध':'d','न':'n','प':'p','फ':'f','ब':'b','भ':'b','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'s','ष':'s','स':'s','ह':'h','ड़':'r','ढ़':'r','ज़':'z','फ़':'f','क़':'q','ख़':'k','ग़':'g'}
UR = {'ب':'b','پ':'p','ت':'t','ٹ':'t','ث':'s','ج':'z','چ':'c','ح':'h','خ':'k','د':'d','ڈ':'d','ذ':'z','ر':'r','ڑ':'r','ز':'z','ژ':'z','س':'s','ش':'s','ص':'s','ض':'z','ط':'t','ظ':'z','ع':'','غ':'g','ف':'f','ق':'q','ک':'k','ك':'k','گ':'g','ل':'l','م':'m','ن':'n','ں':'n','و':'v','ہ':'h','ه':'h','ھ':'h','ۂ':'h','ی':'y','ي':'y','ے':'y','ئ':'y','ۓ':'y'}
def sk_d(s):
    s = unicodedata.normalize('NFC', s); out = []
    for i, ch in enumerate(s):
        if ch == '़' and out: continue
        nxt = s[i+1:i+2]
        k = DV.get(ch + '़') if nxt == '़' else None
        out.append(k or DV.get(ch, ''))
    return re.sub('h', '', ''.join(out))
def sk_u(s): return re.sub('h', '', ''.join(UR.get(ch, '') for ch in s))
def sk_any(s): return sk_d(s) if re.search('[ऀ-ॿ]', s) else sk_u(s)
