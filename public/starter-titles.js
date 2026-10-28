// The 20 Lifeofline film concepts: posters and 5-second animated poster teasers, no film footage.
// They are shown as "Concept showcase · fictional film", never as scheduled releases. When one becomes a real
// production, untick "Concept showcase" in Admin, add a release date, and later upload the film.
// Taglines and genres are read from the posters; check the age ratings in Admin.
const t = (n, id, title, tagline, genre, rating, lang = "Hindi") => ({
  id: "lol-" + id, title, desc: tagline, genre, rating, lang,
  kind: "movie", format: "h", premium: true, original: false, concept: true, published: true, comingSoon: true,
  poster: `posters/${String(n).padStart(2, "0")}-${id}.jpg`, order: 100 + n,
  teaser: `teasers/${String(n).padStart(2, "0")}-${id}.mp4`, // 5-second silent animated poster (720×900)
});

export const STARTER_TITLES = [
  t(1, "sarhad", "Sarhad", "Desh se bada kuch nahi.", "Action · Patriotism · Thriller", "U/A 13+"),
  t(2, "dil-ka-sheher", "Dil Ka Sheher", "Kuch raaste rukte nahi.", "Romance · Drama · Musical", "U/A 13+"),
  t(3, "the-files", "The Files", "Sach hamesha bahar aata hai.", "Thriller · Crime · Mystery", "U/A 16+"),
  t(4, "mitti-di-kasam", "Mitti Di Kasam", "Apni dharti, apne log.", "Drama · Family · Emotional", "U", "Punjabi"),
  t(5, "badla", "Badla", "Har zakhm ka hisaab hoga.", "Action · Revenge · Thriller", "U/A 16+"),
  t(6, "22-yards", "22 Yards", "Khel sirf maidan par nahi hota.", "Sports · Biopic · Drama", "U"),
  t(7, "parivaar-pvt-ltd", "Parivaar Pvt. Ltd.", "Ghar bhi, business bhi.", "Comedy · Family · Drama", "U"),
  t(8, "kaali-raat", "Kaali Raat", "Andheron ka bhi ek raaz hota hai.", "Horror · Supernatural · Thriller", "U/A 16+"),
  t(9, "rajdharma", "Rajdharma", "Singhasan se bada hota hai nyay.", "Historical · Period · Drama", "U/A 13+"),
  t(10, "u-turn", "U-Turn", "Kabhi kabhi wapas jaana zaroori hota hai.", "Drama · Youth · Thriller", "U/A 13+"),
  t(11, "akeli-nahi", "Akeli Nahi", "Har kahani mein ek awaaz hoti hai.", "Drama · Women empowerment · Social", "U/A 13+"),
  t(12, "the-last-heist", "The Last Heist", "Plan bhi hai, par risk zyada hai.", "Crime · Thriller · Action", "U/A 16+"),
  t(13, "papa-ke-liye", "Papa Ke Liye", "Kuch sapne unke bhi the.", "Family · Emotional · Drama", "U"),
  t(14, "beintehaa", "Beintehaa", "Jab pyaar se aage bhi kuch ho.", "Romance · Drama · Musical", "U/A 13+"),
  t(15, "awaaz", "Awaaz", "Sach ko dabaya nahi ja sakta.", "Social · Thriller · Investigative", "U/A 13+"),
  t(16, "yaaron-ka-safar", "Yaaron Ka Safar", "Friends, a red jeep and a long road trip.", "Comedy · Road trip · Friendship", "U/A 7+"),
  t(17, "saza-ya-insaaf", "Saza Ya Insaaf", "Kanoon se bada kaun?", "Courtroom · Drama · Thriller", "U/A 13+"),
  t(18, "antim-seema", "Antim Seema", "Ek nayi duniya ki talaash.", "Sci-fi · Action · Adventure", "U/A 13+"),
  t(19, "chhoti-si-duniya", "Chhoti Si Duniya", "Bada hone ke bahut raaste hain.", "Drama · Slice of life · Family", "U"),
  t(20, "shehar-ke-raaz", "Shehar Ke Raaz", "Har shehar ki ek andaruni duniya hoti hai.", "Crime · Underworld · Thriller", "U/A 16+"),
];

// Titles saved in Firestore earlier pick up the poster, teaser and concept label from here,
// unless an admin has since set "Concept showcase" on the title themselves.
const BY_ID = Object.fromEntries(STARTER_TITLES.map((x) => [x.id, x]));
export const withStarter = (title) => {
  const st = title && BY_ID[title.id];
  if (!st) return title;
  const out = { ...title, poster: title.poster || st.poster, teaser: title.teaser || st.teaser };
  if (title.concept === undefined) { out.concept = true; out.original = false; }
  return out;
};
