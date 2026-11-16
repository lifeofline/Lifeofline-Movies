// The big chapter ("phase") cards on a series page. Keyed by title id, then chapter number.
// A title in the catalogue can override these with its own `chapters` field: [{ n, dev, en, yrs, text, img }].
// Pictures are public-domain works (Wikimedia Commons); credits in series/ghalib/CREDITS.txt.
export const SERIES_CHAPTERS = {
  "ghalib-zinda-hai": {
    1: { dev: "आगरा से दिल्ली", en: "Agra to Delhi", yrs: "1797–1826", img: "series/ghalib/ch1.jpg",
      text: "Born in Agra in 1797 and orphaned at five, Asadullah Khan starts writing verse as a boy. At thirteen he is married and moves to Delhi, and the young poet ‘Asad’ pours out his first, dazzling, difficult ghazals." },
    2: { dev: "बेदिल का साया", en: "Bedil’s shadow", yrs: "1817–1826", img: "series/ghalib/ch2.jpg",
      text: "Young Asad writes in the shadow of the Persian master Bedil: intricate images, wild metaphors, verses even scholars struggle with. Friends tell him to write plainer. Slowly he finds his own voice, and a new pen-name: Ghalib." },
    3: { dev: "कलकत्ते का सफ़र", en: "The Calcutta journey", yrs: "1826–1833", img: "series/ghalib/ch3.jpg",
      text: "His family pension cut, Ghalib rides east through Lucknow and Benares to plead his case in Calcutta. The case fails, but the journey opens his eyes, and his ghazals grow wiser and lighter." },
    4: { dev: "क़र्ज़, ग़म और क़ैद", en: "Debts, losses, prison", yrs: "1833–1847", img: "series/ghalib/ch4.jpg",
      text: "Back in Delhi he lives on credit and wine. All seven of his children die in infancy, and in 1847 he is jailed for gambling. Out of this grief come some of his most famous lines." },
    5: { dev: "ज़फ़र का दरबार", en: "Zafar’s court", yrs: "1847–1857", img: "series/ghalib/ch5.jpg",
      text: "The last Mughal emperor, Bahadur Shah Zafar, makes Ghalib his court poet and historian. Evenings of mushairas in the Red Fort, rivalry with Zauq, and the last bright years of Mughal Delhi." },
    6: { dev: "अठारह सौ सत्तावन", en: "1857", yrs: "1857–1859", img: "series/ghalib/ch6.jpg",
      text: "The revolt reaches Delhi. The city falls, friends are killed or jailed, the emperor is exiled. Ghalib stays home and writes letters: the most honest record of a city’s death." },
    7: { dev: "आख़िरी बरस", en: "The last years", yrs: "1860–1869", img: "series/ghalib/ch7.jpg",
      text: "Old, ill and losing his sight and hearing, Ghalib keeps writing letters full of jokes and sorrow to friends across India. He dies in Delhi in February 1869 and is buried near Nizamuddin." },
  },
};

export function chapterMeta(t, n) {
  const own = Array.isArray(t?.chapters) ? t.chapters.find((c) => String(c.n) === String(n)) : null;
  return own || SERIES_CHAPTERS[t?.id]?.[n] || null;
}
