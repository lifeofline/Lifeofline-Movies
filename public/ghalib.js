// Ghalib Zinda Hai — Season 1: the 72 famous ghazals, one per episode, in the order of the production plan.
// Mirza Ghalib (from his 1860s photograph, animated with AI) recites each ghazal and explains it in his own voice.
// Admin → Titles → "Set up Ghalib Zinda Hai" writes this title and its episodes to the catalogue (videos are uploaded per episode later).
// E01–E05 are free for everyone; the rest are in Premium. An episode without a video shows as "coming soon".
export const GHALIB_ID = "ghalib-zinda-hai";
export const GHALIB_TITLE = {
  id: GHALIB_ID, title: "Ghalib Zinda Hai", kind: "series", format: "v", lang: "Hindi", rating: "U",
  genre: "Poetry · Urdu ghazal · Biography", audio: "Hindustani (Urdu)", subtitles: "Devanagari and English (on the shers)",
  desc: "Mirza Ghalib recites his greatest ghazals and tells you what they mean.",
  synopsis: "Delhi's greatest poet comes alive from his only photograph. In every episode Mirza Ghalib introduces one ghazal — when he wrote it and how old he was — recites each sher, and explains it plainly, the way he wrote his letters. Season 1 has his 72 most-loved ghazals, from “Dil-e-Nadan” to “Hazaron Khwahishen”. The explanations are imagined, in the spirit of his letters; the verses are his.",
  cast: ["Mirza Ghalib (animated from his 1860s photograph)"], director: "Lifeofline Originals", year: "2026",
  premium: true, freeEps: 5, original: true, published: true, comingSoon: true, season: 1, order: 1,
  poster: "posters/ghalib-zinda-hai.jpg", banner: "posters/ghalib-zinda-hai-banner.jpg",
  descriptor: "Classical poetry; mentions of wine and death",
};
// n · Roman title · opening line (Devanagari) · English line · year he wrote it · source ghazal number in the production files
export const GHALIB_EPISODES = [
  {
  "n": 1,
  "name": "Dil-e-Nadan",
  "dev": "दिल-ए-नादाँ तुझे हुआ क्या है",
  "en": "Foolish heart, what has come over you?",
  "year": "1848–1852",
  "ghazal": "202",
  "desc": "दिल-ए-नादाँ तुझे हुआ क्या है — “Foolish heart, what has come over you?” · 1848–1852"
  },
  {
  "n": 2,
  "name": "Hazaron Khwahishen",
  "dev": "हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले",
  "en": "A thousand desires, each worth dying for",
  "year": "1853–1856",
  "ghazal": "224",
  "desc": "हज़ारों ख़्वाहिशें ऐसी कि हर ख़्वाहिश पे दम निकले — “A thousand desires, each worth dying for” · 1853–1856"
  },
  {
  "n": 3,
  "name": "Koi Ummeed Bar Nahin Aati",
  "dev": "कोई उम्मीद बर नहीं आती",
  "en": "No hope comes to fruition",
  "year": "1848–1852",
  "ghazal": "203",
  "desc": "कोई उम्मीद बर नहीं आती — “No hope comes to fruition” · 1848–1852"
  },
  {
  "n": 4,
  "name": "Bazicha-e-Atfal",
  "dev": "बाज़ीचा-ए-अतफ़ाल है दुनिया मिरे आगे",
  "en": "The world is a children’s playground before me",
  "year": "1853–1856",
  "ghazal": "223",
  "desc": "बाज़ीचा-ए-अतफ़ाल है दुनिया मिरे आगे — “The world is a children’s playground before me” · 1853–1856"
  },
  {
  "n": 5,
  "name": "Aah Ko Chahiye",
  "dev": "आह को चाहिए इक उम्र असर होते तक",
  "en": "A sigh needs a lifetime to take effect",
  "year": "1817–1821",
  "ghazal": "128",
  "desc": "आह को चाहिए इक उम्र असर होते तक — “A sigh needs a lifetime to take effect” · 1817–1821"
  },
  {
  "n": 6,
  "name": "Dil Hi To Hai",
  "dev": "दिल ही तो है न संग-ओ-ख़िश्त दर्द से भर न आए क्यूँ",
  "en": "It is only a heart, not stone or brick",
  "year": "1853–1856",
  "ghazal": "222",
  "desc": "दिल ही तो है न संग-ओ-ख़िश्त दर्द से भर न आए क्यूँ — “It is only a heart, not stone or brick” · 1853–1856"
  },
  {
  "n": 7,
  "name": "Na Tha Kuchh To Khuda Tha",
  "dev": "न था कुछ तो ख़ुदा था कुछ न होता तो ख़ुदा होता",
  "en": "When there was nothing, there was God",
  "year": "1848–1852",
  "ghazal": "199",
  "desc": "न था कुछ तो ख़ुदा था कुछ न होता तो ख़ुदा होता — “When there was nothing, there was God” · 1848–1852"
  },
  {
  "n": 8,
  "name": "Ye Na Thi Hamari Qismat",
  "dev": "ये न थी हमारी क़िस्मत कि विसाल-ए-यार होता",
  "en": "It was not my fate to be united with the beloved",
  "year": "1848–1852",
  "ghazal": "201",
  "desc": "ये न थी हमारी क़िस्मत कि विसाल-ए-यार होता — “It was not my fate to be united with the beloved” · 1848–1852"
  },
  {
  "n": 9,
  "name": "Hum Ko Maloom Hai Jannat Ki Haqiqat",
  "dev": "हुस्न-ए-मह गरचे ब-हंगाम-ए-कमाल अच्छा है",
  "en": "I know the truth about paradise",
  "year": "1848–1852",
  "ghazal": "197",
  "desc": "हुस्न-ए-मह गरचे ब-हंगाम-ए-कमाल अच्छा है — “I know the truth about paradise” · 1848–1852"
  },
  {
  "n": 10,
  "name": "Har Ek Baat Pe Kehte Ho",
  "dev": "हर एक बात पे कहते हो तुम कि तू क्या है",
  "en": "At every word you say: what are you?",
  "year": "1848–1852",
  "ghazal": "200",
  "desc": "हर एक बात पे कहते हो तुम कि तू क्या है — “At every word you say: what are you?” · 1848–1852"
  },
  {
  "n": 11,
  "name": "Bas Ki Dushwar Hai",
  "dev": "बस-कि दुश्वार है हर काम का आसाँ होना",
  "en": "",
  "year": "1817–1821",
  "ghazal": "125",
  "desc": "बस-कि दुश्वार है हर काम का आसाँ होना · 1817–1821"
  },
  {
  "n": 12,
  "name": "Ibn-e-Maryam Hua Kare Koi",
  "dev": "इब्न-ए-मरियम हुआ करे कोई",
  "en": "",
  "year": "1848–1852",
  "ghazal": "198",
  "desc": "इब्न-ए-मरियम हुआ करे कोई · 1848–1852"
  },
  {
  "n": 13,
  "name": "Nukta-Cheen Hai Gham-e-Dil",
  "dev": "नुक्ता-चीं है ग़म-ए-दिल उस को सुनाए न बने",
  "en": "",
  "year": "1852",
  "ghazal": "215",
  "desc": "नुक्ता-चीं है ग़म-ए-दिल उस को सुनाए न बने · 1852"
  },
  {
  "n": 14,
  "name": "Phir Mujhe Deeda-e-Tar Yaad Aaya",
  "dev": "फिर मुझे दीदा-ए-तर याद आया",
  "en": "",
  "year": "1817–1821",
  "ghazal": "121",
  "desc": "फिर मुझे दीदा-ए-तर याद आया · 1817–1821"
  },
  {
  "n": 15,
  "name": "Kisi Ko De Ke Dil Koi",
  "dev": "किसी को दे के दिल कोई नवा-संज-ए-फ़ुग़ाँ क्यूँ हो",
  "en": "",
  "year": "1854",
  "ghazal": "227",
  "desc": "किसी को दे के दिल कोई नवा-संज-ए-फ़ुग़ाँ क्यूँ हो · 1854"
  },
  {
  "n": 16,
  "name": "Gayi Wo Baat",
  "dev": "गई वो बात कि हो गुफ़्तुगू तो क्यूँकर हो",
  "en": "",
  "year": "1853–1856",
  "ghazal": "219",
  "desc": "गई वो बात कि हो गुफ़्तुगू तो क्यूँकर हो · 1853–1856"
  },
  {
  "n": 17,
  "name": "Dard Minnat-Kash-e-Dawa Na Hua",
  "dev": "दर्द मिन्नत-कश-ए-दवा न हुआ",
  "en": "",
  "year": "1853",
  "ghazal": "216",
  "desc": "दर्द मिन्नत-कश-ए-दवा न हुआ · 1853"
  },
  {
  "n": 18,
  "name": "Wo Firaq Aur Wo Visal Kahan",
  "dev": "वो फ़िराक़ और वो विसाल कहाँ",
  "en": "",
  "year": "1817–1821",
  "ghazal": "120",
  "desc": "वो फ़िराक़ और वो विसाल कहाँ · 1817–1821"
  },
  {
  "n": 19,
  "name": "Meherban Ho Ke Bula Lo",
  "dev": "इस क़दर ज़ब्त कहाँ है कभी आ भी न सकूँ",
  "en": "",
  "year": "1833",
  "ghazal": "173",
  "desc": "इस क़दर ज़ब्त कहाँ है कभी आ भी न सकूँ · 1833"
  },
  {
  "n": 20,
  "name": "Rahiye Ab Aisi Jagah",
  "dev": "रहिए अब ऐसी जगह चल कर जहाँ कोई न हो",
  "en": "",
  "year": "1833",
  "ghazal": "174",
  "desc": "रहिए अब ऐसी जगह चल कर जहाँ कोई न हो · 1833"
  },
  {
  "n": 21,
  "name": "Zindagi Apni Jab Is Shakl Se Guzri",
  "dev": "और तो रखने को हम दह्र में क्या रखते थे",
  "en": "",
  "year": "1835",
  "ghazal": "175",
  "desc": "और तो रखने को हम दह्र में क्या रखते थे · 1835"
  },
  {
  "n": 22,
  "name": "Is Sadgi Pe Kaun Na Mar Jaye",
  "dev": "दीवानगी से दोश पे ज़ुन्नार भी नहीं",
  "en": "",
  "year": "1826",
  "ghazal": "153",
  "desc": "दीवानगी से दोश पे ज़ुन्नार भी नहीं · 1826"
  },
  {
  "n": 23,
  "name": "Sadgi Par Us Ki Mar Jaane Ki Hasrat",
  "dev": "सादगी पर उस की मर जाने की हसरत दिल में है",
  "en": "",
  "year": "1827–1828",
  "ghazal": "161",
  "desc": "सादगी पर उस की मर जाने की हसरत दिल में है · 1827–1828"
  },
  {
  "n": 24,
  "name": "Qarz Ki Peete The Mai",
  "dev": "हम से खुल जाओ ब-वक़्त-ए-मय-परस्ती एक दिन",
  "en": "",
  "year": "1817–1821",
  "ghazal": "113",
  "desc": "हम से खुल जाओ ब-वक़्त-ए-मय-परस्ती एक दिन · 1817–1821"
  },
  {
  "n": 25,
  "name": "Chahiye Achchhon Ko",
  "dev": "चाहिए अच्छों को जितना चाहिए",
  "en": "",
  "year": "1817–1821",
  "ghazal": "114",
  "desc": "चाहिए अच्छों को जितना चाहिए · 1817–1821"
  },
  {
  "n": 26,
  "name": "Ishrat-e-Qatra Hai Dariya Mein Fana",
  "dev": "इशरत-ए-क़तरा है दरिया में फ़ना हो जाना",
  "en": "",
  "year": "1822–1826",
  "ghazal": "147",
  "desc": "इशरत-ए-क़तरा है दरिया में फ़ना हो जाना · 1822–1826"
  },
  {
  "n": 27,
  "name": "Kehte Hain Jeete Hain Ummeed Pe Log",
  "dev": "इश्क़ तासीर से नौमेद नहीं",
  "en": "",
  "year": "1826",
  "ghazal": "149",
  "desc": "इश्क़ तासीर से नौमेद नहीं · 1826"
  },
  {
  "n": 28,
  "name": "Hairan Hoon Dil Ko Roun",
  "dev": "हैराँ हूँ दिल को रोऊँ कि पीटूँ जिगर को मैं",
  "en": "",
  "year": "1849",
  "ghazal": "204",
  "desc": "हैराँ हूँ दिल को रोऊँ कि पीटूँ जिगर को मैं · 1849"
  },
  {
  "n": 29,
  "name": "Jaur Se Baaz Aaye",
  "dev": "जौर से बाज़ आए पर बाज़ आएँ क्या",
  "en": "",
  "year": "1854",
  "ghazal": "226",
  "desc": "जौर से बाज़ आए पर बाज़ आएँ क्या · 1854"
  },
  {
  "n": 30,
  "name": "Dar-Khur-e-Qahr-o-Ghazab",
  "dev": "दर-ख़ुर-ए-क़हर-ओ-ग़ज़ब जब कोई हम सा न हुआ",
  "en": "",
  "year": "1854",
  "ghazal": "225",
  "desc": "दर-ख़ुर-ए-क़हर-ओ-ग़ज़ब जब कोई हम सा न हुआ · 1854"
  },
  {
  "n": 31,
  "name": "Ki Wafa Hum Se",
  "dev": "की वफ़ा हम से तो ग़ैर इस को जफ़ा कहते हैं",
  "en": "",
  "year": "1847",
  "ghazal": "183",
  "desc": "की वफ़ा हम से तो ग़ैर इस को जफ़ा कहते हैं · 1847"
  },
  {
  "n": 32,
  "name": "Ishq Ne Ghalib Nikamma Kar Diya",
  "dev": "ग़ैर लें महफ़िल में बोसे जाम के",
  "en": "",
  "year": "1853–1856",
  "ghazal": "221",
  "desc": "ग़ैर लें महफ़िल में बोसे जाम के · 1853–1856"
  },
  {
  "n": 33,
  "name": "Hain Aur Bhi Duniya Mein Sukhanwar",
  "dev": "है बस-कि हर इक उन के इशारे में निशाँ और",
  "en": "",
  "year": "1852",
  "ghazal": "213",
  "desc": "है बस-कि हर इक उन के इशारे में निशाँ और · 1852"
  },
  {
  "n": 34,
  "name": "Aaina Dekh Apna Sa Munh Le Ke",
  "dev": "ज़ोफ़-ए-जुनूँ को वक़्त-ए-तपिश दर भी दूर था",
  "en": "",
  "year": "1821",
  "ghazal": "133",
  "desc": "ज़ोफ़-ए-जुनूँ को वक़्त-ए-तपिश दर भी दूर था · 1821"
  },
  {
  "n": 35,
  "name": "Phir Kuchh Ik Dil Ko Beqarari Hai",
  "dev": "फिर कुछ इक दिल को बे-क़रारी है",
  "en": "",
  "year": "1817–1821",
  "ghazal": "122",
  "desc": "फिर कुछ इक दिल को बे-क़रारी है · 1817–1821"
  },
  {
  "n": 36,
  "name": "Aa Ki Meri Jaan Ko Qarar Nahin",
  "dev": "आ कि मिरी जान को क़रार नहीं है",
  "en": "",
  "year": "1817–1821",
  "ghazal": "123",
  "desc": "आ कि मिरी जान को क़रार नहीं है · 1817–1821"
  },
  {
  "n": 37,
  "name": "Ishq Mujh Ko Nahin Wahshat Hi Sahi",
  "dev": "इश्क़ मुझ को नहीं वहशत ही सही",
  "en": "",
  "year": "1817–1821",
  "ghazal": "124",
  "desc": "इश्क़ मुझ को नहीं वहशत ही सही · 1817–1821"
  },
  {
  "n": 38,
  "name": "Husn Ghamze Ki Kashakash Se",
  "dev": "हुस्न ग़म्ज़े की कशाकश से छुटा मेरे बा'द",
  "en": "",
  "year": "1817–1821",
  "ghazal": "117",
  "desc": "हुस्न ग़म्ज़े की कशाकश से छुटा मेरे बा'द · 1817–1821"
  },
  {
  "n": 39,
  "name": "Kehte Ho Na Denge Hum Dil",
  "dev": "कहते हो न देंगे हम दिल अगर पड़ा पाया",
  "en": "",
  "year": "1817–1821",
  "ghazal": "118",
  "desc": "कहते हो न देंगे हम दिल अगर पड़ा पाया · 1817–1821"
  },
  {
  "n": 40,
  "name": "Rone Se Aur Ishq Mein Bebak",
  "dev": "रोने से और इश्क़ में बेबाक हो गए",
  "en": "",
  "year": "1817–1821",
  "ghazal": "119",
  "desc": "रोने से और इश्क़ में बेबाक हो गए · 1817–1821"
  },
  {
  "n": 41,
  "name": "Muddat Hui Hai Yaar Ko Mehman Kiye",
  "dev": "मुद्दत हुई है यार को मेहमाँ किए हुए",
  "en": "",
  "year": "1817–1821",
  "ghazal": "127",
  "desc": "मुद्दत हुई है यार को मेहमाँ किए हुए · 1817–1821"
  },
  {
  "n": 42,
  "name": "Dard Se Mere Hai Tujh Ko Beqarari",
  "dev": "दर्द से मेरे है तुझ को बे-क़रारी हाए हाए",
  "en": "",
  "year": "1817–1821",
  "ghazal": "126",
  "desc": "दर्द से मेरे है तुझ को बे-क़रारी हाए हाए · 1817–1821"
  },
  {
  "n": 43,
  "name": "Daim Pada Hua Tere Dar Par",
  "dev": "दाइम पड़ा हुआ तिरे दर पर नहीं हूँ मैं",
  "en": "",
  "year": "1850",
  "ghazal": "205",
  "desc": "दाइम पड़ा हुआ तिरे दर पर नहीं हूँ मैं · 1850"
  },
  {
  "n": 44,
  "name": "Kehte To Ho Tum Sab",
  "dev": "कहते तो हो तुम सब कि बुत-ए-ग़ालिया-मू आए",
  "en": "",
  "year": "1851",
  "ghazal": "206",
  "desc": "कहते तो हो तुम सब कि बुत-ए-ग़ालिया-मू आए · 1851"
  },
  {
  "n": 45,
  "name": "Koi Din Gar Zindagani Aur Hai",
  "dev": "कोई दिन गर ज़िंदगानी और है",
  "en": "",
  "year": "1848–1852",
  "ghazal": "196",
  "desc": "कोई दिन गर ज़िंदगानी और है · 1848–1852"
  },
  {
  "n": 46,
  "name": "Hui Taakhir To Kuchh Bais-e-Taakhir",
  "dev": "हुई ताख़ीर तो कुछ बाइस-ए-ताख़ीर भी था",
  "en": "",
  "year": "1848–1852",
  "ghazal": "194",
  "desc": "हुई ताख़ीर तो कुछ बाइस-ए-ताख़ीर भी था · 1848–1852"
  },
  {
  "n": 47,
  "name": "Ghar Jab Bana Liya Tere Dar Par",
  "dev": "घर जब बना लिया तिरे दर पर कहे बग़ैर",
  "en": "",
  "year": "1848–1852",
  "ghazal": "191",
  "desc": "घर जब बना लिया तिरे दर पर कहे बग़ैर · 1848–1852"
  },
  {
  "n": 48,
  "name": "Main Unhen Chhedun",
  "dev": "मैं उन्हें छेड़ूँ और कुछ न कहें",
  "en": "",
  "year": "1848–1852",
  "ghazal": "190",
  "desc": "मैं उन्हें छेड़ूँ और कुछ न कहें · 1848–1852"
  },
  {
  "n": 49,
  "name": "Ghar Hamara Jo Na Rote",
  "dev": "घर हमारा जो न रोते भी तो वीराँ होता",
  "en": "",
  "year": "1848–1852",
  "ghazal": "189",
  "desc": "घर हमारा जो न रोते भी तो वीराँ होता · 1848–1852"
  },
  {
  "n": 50,
  "name": "Shikwe Ke Naam Se",
  "dev": "शिकवे के नाम से बे-मेहर ख़फ़ा होता है",
  "en": "",
  "year": "1848–1852",
  "ghazal": "188",
  "desc": "शिकवे के नाम से बे-मेहर ख़फ़ा होता है · 1848–1852"
  },
  {
  "n": 51,
  "name": "Zikr Us Pari-Wash Ka",
  "dev": "ज़िक्र उस परी-वश का और फिर बयाँ अपना",
  "en": "",
  "year": "1848",
  "ghazal": "186",
  "desc": "ज़िक्र उस परी-वश का और फिर बयाँ अपना · 1848"
  },
  {
  "n": 52,
  "name": "Kahoon Jo Haal",
  "dev": "कहूँ जो हाल तो कहते हो मुद्दआ' कहिए",
  "en": "",
  "year": "1853–1856",
  "ghazal": "218",
  "desc": "कहूँ जो हाल तो कहते हो मुद्दआ' कहिए · 1853–1856"
  },
  {
  "n": 53,
  "name": "Nahin Ki Mujh Ko Qayamat Ka",
  "dev": "नहीं कि मुझ को क़यामत का ए'तिक़ाद नहीं",
  "en": "",
  "year": "1855",
  "ghazal": "231",
  "desc": "नहीं कि मुझ को क़यामत का ए'तिक़ाद नहीं · 1855"
  },
  {
  "n": 54,
  "name": "Lazim Tha Ki Dekho Mera Rasta",
  "dev": "लाज़िम था कि देखो मिरा रस्ता कोई दिन और",
  "en": "",
  "year": "1852",
  "ghazal": "212",
  "desc": "लाज़िम था कि देखो मिरा रस्ता कोई दिन और · 1852"
  },
  {
  "n": 55,
  "name": "Sab Kahan Kuchh Lala-o-Gul Mein",
  "dev": "सब कहाँ कुछ लाला-ओ-गुल में नुमायाँ हो गईं",
  "en": "",
  "year": "1852",
  "ghazal": "214",
  "desc": "सब कहाँ कुछ लाला-ओ-गुल में नुमायाँ हो गईं · 1852"
  },
  {
  "n": 56,
  "name": "Naqsh Faryadi Hai",
  "dev": "नक़्श फ़रियादी है किस की शोख़ी-ए-तहरीर का",
  "en": "",
  "year": "1816",
  "ghazal": "081",
  "desc": "नक़्श फ़रियादी है किस की शोख़ी-ए-तहरीर का · 1816"
  },
  {
  "n": 57,
  "name": "Ug Raha Hai Dar-o-Deewar Pe Sabza",
  "dev": "फ़ुर्सत-ए-आईना-ए-सद-रंग-ए-ख़ुद-आराई है",
  "en": "",
  "year": "1816",
  "ghazal": "077",
  "desc": "फ़ुर्सत-ए-आईना-ए-सद-रंग-ए-ख़ुद-आराई है · 1816"
  },
  {
  "n": 58,
  "name": "Arz-e-Niyaz-e-Ishq",
  "dev": "अर्ज़-ए-नियाज़-ए-इश्क़ के क़ाबिल नहीं रहा",
  "en": "",
  "year": "1816",
  "ghazal": "080",
  "desc": "अर्ज़-ए-नियाज़-ए-इश्क़ के क़ाबिल नहीं रहा · 1816"
  },
  {
  "n": 59,
  "name": "Jis Zakhm Ki Ho Sakti Ho Tadbir",
  "dev": "जिस ज़ख़्म की हो सकती हो तदबीर रफ़ू की",
  "en": "",
  "year": "1817–1821",
  "ghazal": "097",
  "desc": "जिस ज़ख़्म की हो सकती हो तदबीर रफ़ू की · 1817–1821"
  },
  {
  "n": 60,
  "name": "Gham-e-Duniya Se Gar Paayi Bhi Fursat",
  "dev": "ग़म-ए-दुनिया से गर पाई भी फ़ुर्सत सर उठाने की",
  "en": "",
  "year": "1817–1821",
  "ghazal": "109",
  "desc": "ग़म-ए-दुनिया से गर पाई भी फ़ुर्सत सर उठाने की · 1817–1821"
  },
  {
  "n": 61,
  "name": "Na Hui Gar Mere Marne Se Tasalli",
  "dev": "न हुई गर मिरे मरने से तसल्ली न सही",
  "en": "",
  "year": "1817–1821",
  "ghazal": "110",
  "desc": "न हुई गर मिरे मरने से तसल्ली न सही · 1817–1821"
  },
  {
  "n": 62,
  "name": "Guncha-e-Nashigufta",
  "dev": "ग़ुंचा-ए-ना-शगुफ़्ता को दूर से मत दिखा कि यूँ",
  "en": "",
  "year": "1817–1821",
  "ghazal": "111",
  "desc": "ग़ुंचा-ए-ना-शगुफ़्ता को दूर से मत दिखा कि यूँ · 1817–1821"
  },
  {
  "n": 63,
  "name": "Na Gul-e-Naghma Hoon",
  "dev": "न गुल-ए-नग़्मा हूँ न पर्दा-ए-साज़",
  "en": "",
  "year": "1817–1821",
  "ghazal": "112",
  "desc": "न गुल-ए-नग़्मा हूँ न पर्दा-ए-साज़ · 1817–1821"
  },
  {
  "n": 64,
  "name": "Ek Chakkar Hai Mere Paon Mein",
  "dev": "माना-ए-दश्त-नवर्दी कोई तदबीर नहीं",
  "en": "",
  "year": "1822–1826",
  "ghazal": "139",
  "desc": "माना-ए-दश्त-नवर्दी कोई तदबीर नहीं · 1822–1826"
  },
  {
  "n": 65,
  "name": "Dekhna Qismat Ki Aap Apne Pe Rashk",
  "dev": "देखना क़िस्मत कि आप अपने पे रश्क आ जाए है",
  "en": "",
  "year": "1822–1826",
  "ghazal": "141",
  "desc": "देखना क़िस्मत कि आप अपने पे रश्क आ जाए है · 1822–1826"
  },
  {
  "n": 66,
  "name": "Masjid Ke Zer-e-Saya Kharabat",
  "dev": "मस्जिद के ज़ेर-ए-साया ख़राबात चाहिए",
  "en": "",
  "year": "1822–1826",
  "ghazal": "142",
  "desc": "मस्जिद के ज़ेर-ए-साया ख़राबात चाहिए · 1822–1826"
  },
  {
  "n": 67,
  "name": "Faryad Ki Koi Lai Nahin",
  "dev": "फ़रियाद की कोई लय नहीं है",
  "en": "",
  "year": "1826",
  "ghazal": "152",
  "desc": "फ़रियाद की कोई लय नहीं है · 1826"
  },
  {
  "n": 68,
  "name": "Aabru Kya Khaak Us Gul Ki",
  "dev": "आबरू क्या ख़ाक उस गुल की कि गुलशन में नहीं",
  "en": "",
  "year": "1827–1828",
  "ghazal": "156",
  "desc": "आबरू क्या ख़ाक उस गुल की कि गुलशन में नहीं · 1827–1828"
  },
  {
  "n": 69,
  "name": "Kab Wo Sunta Hai Kahani Meri",
  "dev": "कब वो सुनता है कहानी मेरी",
  "en": "",
  "year": "1827–1828",
  "ghazal": "158",
  "desc": "कब वो सुनता है कहानी मेरी · 1827–1828"
  },
  {
  "n": 70,
  "name": "Sataish-Gar Hai Zahid",
  "dev": "सताइश-गर है ज़ाहिद इस क़दर जिस बाग़-ए-रिज़वाँ का",
  "en": "",
  "year": "1827–1828",
  "ghazal": "159",
  "desc": "सताइश-गर है ज़ाहिद इस क़दर जिस बाग़-ए-रिज़वाँ का · 1827–1828"
  },
  {
  "n": 71,
  "name": "Kyun Jal Gaya Na Taab-e-Rukh-e-Yaar",
  "dev": "क्यूँ जल गया न ताब-ए-रुख़-ए-यार देख कर",
  "en": "",
  "year": "1833",
  "ghazal": "170",
  "desc": "क्यूँ जल गया न ताब-ए-रुख़-ए-यार देख कर · 1833"
  },
  {
  "n": 72,
  "name": "Ye Hum Jo Hijr Mein",
  "dev": "ये हम जो हिज्र में दीवार-ओ-दर को देखते हैं",
  "en": "",
  "year": "1833",
  "ghazal": "171",
  "desc": "ये हम जो हिज्र में दीवार-ओ-दर को देखते हैं · 1833"
  }
  ];
