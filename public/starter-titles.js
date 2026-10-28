// The 20 Lifeofline films with posters but no video yet. They show as "Coming soon" until a video is uploaded
// in Admin and "Coming soon" is unticked. Taglines and genres are read from the posters; check the age
// ratings in Admin (the IT Rules make the publisher responsible for them).
const t = (n, id, title, tagline, genre, rating, lang = "Hindi") => ({
  id: "lol-" + id, title, desc: tagline, genre, rating, lang,
  kind: "movie", format: "h", premium: true, original: true, published: true, comingSoon: true,
  poster: `posters/${String(n).padStart(2, "0")}-${id}.jpg`, order: 100 + n,
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
