const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

// ─── CONFIG ───────────────────────────────────────────────
const TOKEN = "8587491091:AAE1ym5zMBoLqjyHumIL5LisPTw-_bzP3Ww";
const ADMIN_USERNAME = "fihole";
const ADMIN_TG_USERNAME_WITH_AT = "@fihole";
const MIN_WITHDRAW = 10;
const DAILY_SUBJECT_LIMIT = 3;
const TESTS_PER_SUBJECT = 3;
const TEST_TIME_SECONDS = 30;
const REFERRAL_BONUS = 3;

// ─── RENDER SERVER & PINGER ───────────────────────────────
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is running!");
}).listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Self-ping to prevent Render sleep
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
  setInterval(() => {
    https.get(RENDER_EXTERNAL_URL, (res) => {
      console.log(`Pinger response: ${res.statusCode}`);
    }).on('error', (e) => console.error("Pinger error:", e.message));
  }, 5 * 60 * 1000); // 5 minutes
}

// ─── DATABASE (JSON FILE) ────────────────────────────────
const dbPath = path.join(__dirname, "db.json");

/* 
  Data shape:
  {
    users: [ { id, username, first_name, diamonds, referral_count, referred_by, created_at } ],
    daily_progress: [ { user_id, subject_id, test_index, day } ],
    withdrawals: [ { id, user_id, amount, code, status, created_at } ]
  }
*/

let dbData = { users: [], daily_progress: [], withdrawals: [], w_id_seq: 1 };

function loadDB() {
  if (fs.existsSync(dbPath)) {
    try {
      dbData = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    } catch (e) {}
  }
}

function saveDB() {
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));
}

loadDB();

// ─── BOT ─────────────────────────────────────────────────
const bot = new TelegramBot(TOKEN, { polling: true });

// ─── SUBJECTS & QUESTIONS ────────────────────────────────
const subjects = [
  { id: 1, emoji: "🧮", name: "Matematika" },
  { id: 2, emoji: "🔬", name: "Kimyo" },
  { id: 3, emoji: "⚡", name: "Fizika" },
  { id: 4, emoji: "🌿", name: "Biologiya" },
  { id: 5, emoji: "🌍", name: "Geografiya" },
  { id: 6, emoji: "📜", name: "Tarix" },
  { id: 7, emoji: "🇺🇿", name: "O'zbek tili" },
  { id: 8, emoji: "🇬🇧", name: "Ingliz tili" },
  { id: 9, emoji: "💻", name: "Informatika" },
  { id: 10, emoji: "📚", name: "Adabiyot" },
  { id: 11, emoji: "🏛️", name: "Huquq" },
  { id: 12, emoji: "🧠", name: "Mantiq" },
];

const questions = {
  1: [ // Matematika
    { q: "2² + 3² = ?", options: ["10", "12", "13", "15"], answer: 2 },
    { q: "√144 = ?", options: ["10", "12", "14", "16"], answer: 1 },
    { q: "5! (faktorial) = ?", options: ["100", "60", "120", "24"], answer: 2 },
    { q: "log₁₀(1000) = ?", options: ["2", "3", "4", "10"], answer: 1 },
    { q: "x² - 5x + 6 = 0, x = ?", options: ["1 va 6", "2 va 3", "3 va 4", "-2 va -3"], answer: 1 },
    { q: "sin(90°) = ?", options: ["0", "1", "-1", "0.5"], answer: 1 },
    { q: "Agar 3x = 27 bo'lsa, x = ?", options: ["3", "9", "5", "6"], answer: 0 },
    { q: "Trapeziyaning yuzasi S = (a+b)/2 × h, a=6 b=4 h=3, S=?", options: ["15", "10", "12", "18"], answer: 0 },
    { q: "2⁸ = ?", options: ["128", "256", "512", "64"], answer: 1 },
  ],
  2: [ // Kimyo
    { q: "Suvning kimyoviy formulasi?", options: ["CO₂", "H₂O", "NaCl", "O₂"], answer: 1 },
    { q: "Osh tuzi formulasi?", options: ["KCl", "CaCl₂", "NaCl", "MgCl₂"], answer: 2 },
    { q: "Kislorodning atom soni?", options: ["6", "7", "8", "9"], answer: 2 },
    { q: "pH = 7 bu?", options: ["Kislota", "Neytral", "Ishqor", "Tuz"], answer: 1 },
    { q: "H₂SO₄ bu?", options: ["Xlorid kislota", "Sulfat kislota", "Nitrat kislota", "Karbonat"], answer: 1 },
    { q: "Vodorodning atom massasi?", options: ["1", "2", "4", "8"], answer: 0 },
    { q: "CO₂ bu qanday gaz?", options: ["Kislorod", "Azot", "Karbon dioksid", "Metan"], answer: 2 },
    { q: "Temir elementi belgisi?", options: ["Fe", "Au", "Ag", "Cu"], answer: 0 },
    { q: "Oltin elementi belgisi?", options: ["Ag", "Au", "Pt", "Fe"], answer: 1 },
  ],
  3: [ // Fizika
    { q: "Yorug'lik tezligi taxminan?", options: ["150,000 km/s", "300,000 km/s", "450,000 km/s", "100,000 km/s"], answer: 1 },
    { q: "F = ma — bu qaysi qonun?", options: ["1-qonun", "2-qonun", "3-qonun", "Arximed"], answer: 1 },
    { q: "1 kWt soat = ? J", options: ["3,6 MJ", "1,8 MJ", "7,2 MJ", "0,9 MJ"], answer: 0 },
    { q: "Elektr qarshilik birligi?", options: ["Amper", "Volt", "Om", "Vatt"], answer: 2 },
    { q: "Ohmning qonuni?", options: ["F=ma", "E=mc²", "I=U/R", "P=IV"], answer: 2 },
    { q: "Erkin tushish tezlanishi g ≈ ?", options: ["9.8 m/s²", "10.8 m/s²", "8.9 m/s²", "11 m/s²"], answer: 0 },
    { q: "Nurning sinishi — bu?", options: ["Difraktsiya", "Interferensiya", "Refraktsiya", "Polarizatsiya"], answer: 2 },
    { q: "Issiqlik miqdori birligi?", options: ["Vatt", "Joule", "Kelvin", "Pascal"], answer: 1 },
    { q: "Magnit induktsiya birligi?", options: ["Teslа", "Volt", "Amper", "Farad"], answer: 0 },
  ],
  4: [ // Biologiya
    { q: "DNK nimaning qisqartmasi?", options: ["Dezoksiribonuklein kislota", "Ribonuklein kislota", "Amino kislota", "Nuklein proteini"], answer: 0 },
    { q: "Fotosintez qayerda bo'ladi?", options: ["Mitoxondriya", "Xloroplast", "Yadro", "Ribosoma"], answer: 1 },
    { q: "Odam qancha xromosomaga ega?", options: ["42", "44", "46", "48"], answer: 2 },
    { q: "Qon guruhi nechta?", options: ["2", "3", "4", "5"], answer: 2 },
    { q: "Eng yirik hujayra organоidi?", options: ["Ribosoma", "Golji", "Mitoxondriya", "Yadro"], answer: 3 },
    { q: "Hayvonlarning klassifikatsiyasini kim yaratgan?", options: ["Darwin", "Linney", "Mendel", "Pasteur"], answer: 1 },
    { q: "ATP nima?", options: ["Oqsil", "Energiya manbai", "DNK turi", "Vitamin"], answer: 1 },
    { q: "Odamda qancha suyak bor?", options: ["186", "206", "226", "246"], answer: 1 },
    { q: "Qon tazyiqini o'lchovchi asbob?", options: ["Termometr", "Tonometr", "Manometr", "Barometr"], answer: 1 },
  ],
  5: [ // Geografiya
    { q: "Dunyoning eng baland tog'i?", options: ["K2", "Everest", "Elbrus", "Kilimanjaro"], answer: 1 },
    { q: "O'zbekistonning poytaxti?", options: ["Samarqand", "Buxoro", "Toshkent", "Namangan"], answer: 2 },
    { q: "Dunyo qancha qit'adan iborat?", options: ["5", "6", "7", "8"], answer: 2 },
    { q: "Eng katta okean?", options: ["Atlantik", "Hind", "Tinch", "Arktika"], answer: 2 },
    { q: "Nil daryosi qaysi qit'ada?", options: ["Osiyo", "Amerika", "Afrika", "Yevropa"], answer: 2 },
    { q: "O'zbekiston qachon mustaqil bo'ldi?", options: ["1990", "1991", "1992", "1993"], answer: 1 },
    { q: "Sahara cho'li qaysi qit'ada?", options: ["Osiyo", "Afrika", "Amerika", "Avstraliya"], answer: 1 },
    { q: "Dunyo aholisi taxminan necha milliard?", options: ["6", "7", "8", "9"], answer: 2 },
    { q: "Amazon daryosi qaysi mamlakatda?", options: ["Argentina", "Braziliya", "Peru", "Kolombiya"], answer: 1 },
  ],
  6: [ // Tarix
    { q: "Amir Temur qachon tug'ilgan?", options: ["1326", "1336", "1346", "1356"], answer: 1 },
    { q: "Birinchi jahon urushi qachon boshlangan?", options: ["1912", "1914", "1916", "1918"], answer: 1 },
    { q: "Ikkinchi jahon urushi qachon tugagan?", options: ["1943", "1944", "1945", "1946"], answer: 2 },
    { q: "Amerika qachon kashf etilgan?", options: ["1392", "1492", "1592", "1692"], answer: 1 },
    { q: "Ulug'bek kim bo'lgan?", options: ["Shoir", "Astronom va hukmdor", "Jangchi", "Savdogar"], answer: 1 },
    { q: "Napoleonning vatani?", options: ["Frantsiya", "Italiya", "Korsika/Frantsiya", "Ispaniya"], answer: 2 },
    { q: "SSSR qachon parchalangan?", options: ["1989", "1990", "1991", "1992"], answer: 2 },
    { q: "Buyuk ipak yo'li qaysi shahardan o'tgan?", options: ["Samarqand", "Buxoro", "Xiva", "Hammasi"], answer: 3 },
    { q: "Al-Xorazmiy kim bo'lgan?", options: ["Shoir", "Matematik va olim", "Jangchi", "Hukmdor"], answer: 1 },
  ],
  7: [ // O'zbek tili
    { q: "O'zbek alifbosida nechta harf bor?", options: ["29", "32", "35", "28"], answer: 0 },
    { q: "'Kitob' so'zida nechta bo'g'in?", options: ["1", "2", "3", "4"], answer: 1 },
    { q: "Fe'lning zamonlari nechta?", options: ["2", "3", "4", "5"], answer: 1 },
    { q: "'Baxt' so'zining antonimi?", options: ["Quvonch", "Baxtsizlik", "Shodlik", "Sevinch"], answer: 1 },
    { q: "O'zbek tilida nechta unli tovush bor?", options: ["4", "5", "6", "7"], answer: 2 },
    { q: "Ot so'z turkumi nimani bildiradi?", options: ["Harakat", "Belgi", "Narsa-buyum", "Miqdor"], answer: 2 },
    { q: "Sifat qanday savolga javob beradi?", options: ["Kim? Nima?", "Qanday? Qanaqa?", "Qachon?", "Qayer?"], answer: 1 },
    { q: "'Ona' so'zi qanday so'z turkumi?", options: ["Fe'l", "Sifat", "Ot", "Ravish"], answer: 2 },
    { q: "Gapning bosh bo'laklari?", options: ["Ega va kesim", "Ega va to'ldiruvchi", "Kesim va aniqlovchi", "Hol va kesim"], answer: 0 },
  ],
  8: [ // Ingliz tili
    { q: "To be yoki not to be — kim aytgan?", options: ["Romeo", "Hamlet", "Macbeth", "Othello"], answer: 1 },
    { q: "'Apple' o'zbek tilida?", options: ["Nok", "Olma", "Uzum", "Shaftoli"], answer: 1 },
    { q: "Present Simple da 'He ___' plays yoki play?", options: ["play", "plays", "played", "playing"], answer: 1 },
    { q: "'Beautiful' so'zining antonimi?", options: ["Ugly", "Pretty", "Cute", "Nice"], answer: 0 },
    { q: "Ingliz tilida nechta vowel (unli) harf bor?", options: ["4", "5", "6", "7"], answer: 1 },
    { q: "'I am going to school' — qaysi zamon?", options: ["Past", "Present Continuous", "Future", "Present Simple"], answer: 1 },
    { q: "The capital of England?", options: ["Manchester", "Liverpool", "London", "Oxford"], answer: 2 },
    { q: "'Big' so'zining sinonimi?", options: ["Small", "Large", "Tiny", "Little"], answer: 1 },
    { q: "'Yesterday I ___ to school.' to'g'ri variant?", options: ["go", "goes", "went", "going"], answer: 2 },
  ],
  9: [ // Informatika
    { q: "CPU nima?", options: ["Xotira", "Protsessor", "Monitor", "Klaviatura"], answer: 1 },
    { q: "WWW nimaning qisqartmasi?", options: ["World Wide Web", "World Web Wide", "Web World Wide", "Wide World Web"], answer: 0 },
    { q: "1 GB = ? MB", options: ["512", "1000", "1024", "2048"], answer: 2 },
    { q: "Python bu?", options: ["Operatsion sistema", "Dasturlash tili", "Internet brauzer", "Antivirus"], answer: 1 },
    { q: "HTML nima?", options: ["Dasturlash tili", "Belgilash tili", "Dastur", "Operatsion sistema"], answer: 1 },
    { q: "RAM nima?", options: ["Doimiy xotira", "Operativ xotira", "Grafik karta", "Qattiq disk"], answer: 1 },
    { q: "IP manzil nima?", options: ["Internet protokol manzil", "Internet parol", "Tarmoq nomi", "Kompyuter nomi"], answer: 0 },
    { q: "Binary sistemada 1010 = ?", options: ["8", "10", "12", "14"], answer: 1 },
    { q: "SQL nima?", options: ["Dasturlash tili", "Bazalar bilan ishlash tili", "Markup tili", "Skript tili"], answer: 1 },
  ],
  10: [ // Adabiyot
    { q: "Alisher Navoiy qachon tug'ilgan?", options: ["1441", "1451", "1461", "1471"], answer: 0 },
    { q: "Navoiyning asosiy asari?", options: ["Shohnoma", "Xamsa", "Boburnoma", "Devonu lug'atit-turk"], answer: 1 },
    { q: "Abdulla Qodiriy kim bo'lgan?", options: ["Shoir", "Romаnnavis", "Dramaturg", "Olim"], answer: 1 },
    { q: "'O'tkan kunlar' romanining muallifi?", options: ["Hamza", "Abdulla Qodiriy", "Cho'lpon", "Oybek"], answer: 1 },
    { q: "Cho'lponning asosiy janri?", options: ["Roman", "She'riyat", "Drama", "Hikoya"], answer: 1 },
    { q: "Firdavsiyning mashhur dostonі?", options: ["Xamsa", "Shohnoma", "Lison ut-tayr", "Mahbub ul-qulub"], answer: 1 },
    { q: "Boburnoma kim tomonidan yozilgan?", options: ["Temur", "Ulug'bek", "Bobur", "Husayn Boyqaro"], answer: 2 },
    { q: "Oybek kim bo'lgan?", options: ["Romаnnavis", "Shoir va yozuvchi", "Dramaturg", "Tarjimon"], answer: 1 },
    { q: "Hamza Hakimzoda Niyoziy kim bo'lgan?", options: ["Shoir", "Dramaturg va shoir", "Romаnnavis", "Muarrix"], answer: 1 },
  ],
  11: [ // Huquq
    { q: "O'zbekiston Konstitutsiyasi qachon qabul qilingan?", options: ["1990", "1991", "1992", "1993"], answer: 2 },
    { q: "Fuqarolik huquqi va majburiyatlarini kim belgilaydi?", options: ["Prezident", "Konstitutsiya", "Parlament", "Sud"], answer: 1 },
    { q: "Qonun loyihasini kim taklif qiladi?", options: ["Faqat prezident", "Faqat parlament", "Har ikkalasi va fuqarolar", "Faqat hukumat"], answer: 2 },
    { q: "O'zbekistonda saylov yoshi necha?", options: ["16", "18", "20", "21"], answer: 1 },
    { q: "Jinoyat kodeksi nimani tartibga soladi?", options: ["Fuqarolik munosabatlarni", "Jinoyatlar va jazoları", "Soliqlarni", "Mehnat munosabatlarni"], answer: 1 },
    { q: "Adliya ishi qanday tamoyilga asoslanadi?", options: ["Ochiqlik", "Adolat va teng huquqlilik", "Tezlik", "Maxfiylik"], answer: 1 },
    { q: "Huquqiy davlat nimani anglatadi?", options: ["Kuchli armiyа", "Qonun ustunligi", "Ko'p boylik", "Yirik hudud"], answer: 1 },
    { q: "Inson huquqlari deklaratsiyasi qachon qabul qilingan?", options: ["1945", "1948", "1950", "1955"], answer: 1 },
    { q: "Prezidentlik muddati O'zbekistonda?", options: ["4 yil", "5 yil", "6 yil", "7 yil"], answer: 3 },
  ],
  12: [ // Mantiq
    { q: "5, 10, 20, 40, _?", options: ["60", "70", "80", "100"], answer: 2 },
    { q: "ABA, CDC, EFE, _?", options: ["GHG", "HIH", "GIG", "HGH"], answer: 0 },
    { q: "1+1=2, 2+2=4, 3+3=6, 4+4=?", options: ["7", "8", "9", "10"], answer: 1 },
    { q: "Qaysi biri juft son: 3, 5, 8, 11?", options: ["3", "5", "8", "11"], answer: 2 },
    { q: "Otam 40 yoshda, men 10 yoshdaman. 10 yildan keyin necha marta katta bo'ladi?", options: ["4", "3", "2", "5"], answer: 2 },
    { q: "3 quti bor, har birida 3 olma. Jami olma?", options: ["6", "9", "12", "3"], answer: 1 },
    { q: "1² + 2² + 3² = ?", options: ["12", "14", "16", "18"], answer: 1 },
    { q: "Qaysi so'z boshqacha: Olma, Nok, Uzum, Lavlagi?", options: ["Olma", "Nok", "Uzum", "Lavlagi"], answer: 3 },
    { q: "100 ni 4 ga bo'lsak, undan 5 ni ayirsak?", options: ["15", "20", "25", "30"], answer: 1 },
  ],
};

// ─── HELPERS ──────────────────────────────────────────────
function getOrCreateUser(from) {
  let user = dbData.users.find(u => u.id === from.id);
  if (!user) {
    user = {
      id: from.id,
      username: from.username || null,
      first_name: from.first_name || "Foydalanuvchi",
      diamonds: 0,
      referral_count: 0,
      referred_by: null,
      created_at: new Date().toISOString()
    };
    dbData.users.push(user);
    saveDB();
  }
  return user;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getDailySubjectCount(userId) {
  const today = getToday();
  const subjectsDoneToday = new Set(
    dbData.daily_progress
      .filter(p => p.user_id === userId && p.day === today)
      .map(p => p.subject_id)
  );
  return subjectsDoneToday.size;
}

function getSubjectTestIndex(userId, subjectId) {
  const today = getToday();
  const p = dbData.daily_progress.find(x => x.user_id === userId && x.subject_id === subjectId && x.day === today);
  return p ? p.test_index : 0;
}

function incrementSubjectTest(userId, subjectId) {
  const today = getToday();
  let p = dbData.daily_progress.find(x => x.user_id === userId && x.subject_id === subjectId && x.day === today);
  if (p) {
    p.test_index += 1;
  } else {
    dbData.daily_progress.push({ user_id: userId, subject_id: subjectId, test_index: 1, day: today });
  }
  saveDB();
}

function addDiamonds(userId, amount) {
  let user = dbData.users.find(u => u.id === userId);
  if (user) {
    user.diamonds += amount;
    saveDB();
  }
}

function subDiamonds(userId, amount) {
  let user = dbData.users.find(u => u.id === userId);
  if (user) {
    user.diamonds -= amount;
    saveDB();
  }
}

function pickQuestionForAttempt(subjectId, attemptNumber) {
  const subjectQuestions = questions[subjectId];
  const safeLength = subjectQuestions.length || 1;
  const questionIndex = Math.abs((attemptNumber * 7 + subjectId * 11) % safeLength);
  return { question: subjectQuestions[questionIndex], questionIndex };
}

function stopActiveQuestionTimers(state) {
  if (!state) return;
  if (state.timerId) clearTimeout(state.timerId);
  if (state.countdownIntervalId) clearInterval(state.countdownIntervalId);
}

async function notifyAdmin(text, options = {}) {
  const adminObj = dbData.users.find(u => u.username === ADMIN_USERNAME);
  if (adminObj) {
    await bot.sendMessage(adminObj.id, text, options);
    return;
  }
  await bot.sendMessage(ADMIN_TG_USERNAME_WITH_AT, text, options);
}

function getReferralLink(userId) {
  return `https://t.me/${getBotUsername()}?start=ref_${userId}`;
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let botUsername = "";
async function fetchBotUsername() {
  try {
    const me = await bot.getMe();
    botUsername = me.username;
  } catch (e) {}
}
function getBotUsername() {
  return botUsername || "olmostestbot";
}

// ─── STATE MAP (in-memory) ────────────────────────────────
const userState = new Map();

// ─── KEYBOARDS ────────────────────────────────────────────
function mainKeyboard(fromObj) {
  return {
    reply_markup: {
      keyboard: (function() {
        let kb = [
          [{ text: "💎 Hisobim" }, { text: "👥 Referal" }],
          [{ text: "📚 Testlar" }, { text: "💸 Olmos yechish" }],
          [{ text: "🛒 Olmos sotib olish" }],
        ];
        if (fromObj && fromObj.username === ADMIN_USERNAME) {
          kb.push([{ text: "👑 Admin Panel" }]);
        }
        return kb;
      })(),
      resize_keyboard: true,
    },
  };
}

function subjectsKeyboard(userId) {
  const rows = [];
  let row = [];
  subjects.forEach((s, i) => {
    const testIdx = getSubjectTestIndex(userId, s.id);
    const done = testIdx >= TESTS_PER_SUBJECT;
    const label = done ? `✅ ${s.emoji} ${s.name}` : `${s.emoji} ${s.name}`;
    row.push({ text: label });
    if (row.length === 3) {
      rows.push(row);
      row = [];
    }
  });
  if (row.length) rows.push(row);
  rows.push([{ text: "⬅️ Orqaga" }]);
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
    },
  };
}

// ─── /start ───────────────────────────────────────────────
bot.onText(/\/start(.*)/, async (msg, match) => {
  const from = msg.from;
  const param = (match[1] || "").trim();

  let user = dbData.users.find(u => u.id === from.id);
  const isNew = !user;
  user = getOrCreateUser(from);

  // Referral
  console.log(`[DEBUG] /start param: "${param}" | User ID: ${from.id}`);

  if (param.startsWith("ref_")) {
    const refId = parseInt(param.replace("ref_", ""));
    console.log(`[DEBUG] Attempting referral from ID: ${refId}`);

    // If user is new OR doesn't have a referrer yet
    if (refId && refId !== from.id && (!user.referred_by)) {
      let refUser = dbData.users.find(u => u.id === refId);
      if (refUser) {
        user.referred_by = refId;
        refUser.diamonds += REFERRAL_BONUS;
        refUser.referral_count += 1;
        saveDB();
        console.log(`[DEBUG] Referral successful! ${refId} earned ${REFERRAL_BONUS} diamonds.`);
        try {
          await bot.sendMessage(
            refId, 
            `🎉 <b>Yangi referal!</b> Do'stingiz <b>${esc(from.first_name)}</b> qo'shildi!\n` +
            `➕ Hisobingizga <b>+${REFERRAL_BONUS}</b> 💎 olmos qo'shildi!`,
            { parse_mode: "HTML" }
          );
        } catch (e) {
          console.error(`[DEBUG] Failed to send referral message to ${refId}:`, e.message);
        }
      } else {
        console.log(`[DEBUG] Referral failed: refUser ${refId} not found in DB.`);
      }
    } else {
      console.log(`[DEBUG] Referral skipped: Already has referrer or self-referral.`);
    }
  }

  await bot.sendMessage(
    from.id,
    `👋 Salom, <b>${esc(from.first_name)}</b>!\n\n` +
    `🎓 <b>Diamond Quiz Bot</b>ga xush kelibsiz!\n\n` +
    `📚 Testlarga to'g'ri javob berib, 💎 olmos ishlang!\n` +
    `✅ Har to'g'ri javob = +1 💎 olmos\n` +
    `👥 Har do'st taklif = +${REFERRAL_BONUS} 💎 olmos\n\n` +
    `Pastdagi menyudan tanlang:`,
    { parse_mode: "HTML", ...mainKeyboard(from) }
  );
});

// ─── TEXT HANDLER ─────────────────────────────────────────
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  const text = msg.text;
  const from = msg.from;
  const chatId = msg.chat.id;
  const user = getOrCreateUser(from);
  const state = userState.get(from.id) || {};

  // ── HISOBIM ──
  if (text === "💎 Hisobim") {
    userState.delete(from.id);
    const referrals = dbData.users
      .filter(u => u.referred_by === from.id)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const refList = referrals.length
      ? referrals.map((r, i) => `${i + 1}. ${r.first_name}${r.username ? ` (@${r.username})` : ""} | ID: ${r.id}`).join("\n")
      : "Hali referal yo'q.";
    await bot.sendMessage(
      chatId,
      `💎 <b>Sizning hisobingiz</b>\n\n` +
      `🆔 ID: <code>${from.id}</code>\n` +
      `💎 Olmoslar: <b>${user.diamonds}</b>\n` +
      `👥 Referallar: <b>${referrals.length}</b> ta\n\n` +
      `📋 <b>Referallar ro'yxati:</b>\n${esc(refList)}`,
      { parse_mode: "HTML", ...mainKeyboard(from) }
    );
    return;
  }

  // ── REFERAL ──
  if (text === "👥 Referal") {
    userState.delete(from.id);
    const link = getReferralLink(from.id);
    const referrals = dbData.users.filter(u => u.referred_by === from.id);
    let refList = referrals.length
      ? referrals.map((r, i) => `${i + 1}. ${safeText(r.first_name)}${r.username ? " (@" + safeText(r.username) + ")" : ""}`).join("\n")
      : "Hali hech kim yo'q";

    await bot.sendMessage(
      chatId,
      `👥 <b>Referal tizimi</b>\n\n` +
      `🔗 Sizning referal havolangiz:\n<code>${link}</code>\n\n` +
      `📊 Taklif qilganlar (${referrals.length} ta):\n${refList}\n\n` +
      `💎 Har bir do'st uchun +${REFERRAL_BONUS} olmos!`,
      { parse_mode: "HTML", ...mainKeyboard(from) }
    );
    return;
  }

  // ── OLMOS YECHISH ──
  if (text === "💸 Olmos yechish") {
    userState.set(from.id, { step: "withdraw_amount" });
    await bot.sendMessage(
      chatId,
      `💸 <b>Olmos yechish</b>\n\n` +
      `💎 Sizda: <b>${user.diamonds}</b> olmos\n\n` +
      `Yechmoqchi bo'lgan miqdorni kiriting:\n<i>(Minimal: ${MIN_WITHDRAW} ta)</i>`,
      { parse_mode: "HTML", reply_markup: { keyboard: [["❌ Bekor qilish"]], resize_keyboard: true } }
    );
    return;
  }

  if (state.step === "withdraw_amount") {
    if (text === "❌ Bekor qilish") {
      userState.delete(from.id);
      await bot.sendMessage(chatId, "Bekor qilindi.", mainKeyboard(from || {}));
      return;
    }
    const amount = parseInt(text);
    if (isNaN(amount) || amount < MIN_WITHDRAW) {
      await bot.sendMessage(chatId, `❌ Minimal miqdor ${MIN_WITHDRAW} ta olmos!\nQayta kiriting:`);
      return;
    }
    if (amount > user.diamonds) {
      await bot.sendMessage(chatId, `❌ Sizda faqat ${user.diamonds} ta olmos bor!\nQayta kiriting:`);
      return;
    }
    userState.set(from.id, { step: "withdraw_code", amount });
    await bot.sendMessage(
      chatId,
      `✅ Miqdor: <b>${amount}</b> olmos\n\n🔐 Endi codingizni kiriting:\n<i>(Kod olish uchun ${ADMIN_TG_USERNAME_WITH_AT} ga murojaat qiling)</i>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (state.step === "withdraw_code") {
    if (text === "❌ Bekor qilish") {
      userState.delete(from.id);
      await bot.sendMessage(chatId, "Bekor qilindi.", mainKeyboard(from || {}));
      return;
    }
    const code = text.trim();
    const amount = state.amount;

    if (user.diamonds < amount) {
      userState.delete(from.id);
      await bot.sendMessage(chatId, "❌ Yetarli olmos yo'q!", mainKeyboard(from || {}));
      return;
    }

    subDiamonds(from.id, amount);
    const wid = dbData.w_id_seq++;
    dbData.withdrawals.push({
      id: wid,
      user_id: from.id,
      amount,
      code,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    saveDB();

    const userTag = from.username ? `@${esc(from.username)}` : esc(from.first_name);
    const adminMsg =
      `💸 <b>Olmos yechish so'rovi!</b>\n\n` +
      `👤 Foydalanuvchi: ${userTag}\n` +
      `🆔 ID: ${from.id}\n` +
      `💎 Miqdor: ${amount} olmos\n` +
      `🔑 Kod: ${code}\n\n` +
      `Tasdiqlash uchun /approve_${wid} yozing`;

    try {
      await notifyAdmin(adminMsg, { parse_mode: "HTML" });
    } catch (e) {}

    userState.delete(from.id);
    await bot.sendMessage(
      chatId,
      `✅ So'rovingiz yuborildi!\n\n` +
      `💎 ${amount} olmos yechish so'rovi admin ${ADMIN_TG_USERNAME_WITH_AT} ga yuborildi.\n` +
      `Tez orada siz bilan bog'lanishadi!`,
      mainKeyboard(from || {})
    );
    return;
  }

  // ── OLMOS SOTB OLISH ──
  if (text === "🛒 Olmos sotib olish") {
    userState.delete(from.id);
    await bot.sendMessage(
      chatId,
      `🛒 *Olmos sotib olish*\n\n` +
      `💎 Olmos sotib olish uchun adminga yozing:\n\n` +
      `👉 ${ADMIN_TG_USERNAME_WITH_AT}\n\n` +
      `_Narxlar admin tomonidan belgilanadi_`,
      { parse_mode: "Markdown", ...mainKeyboard(from || {}) }
    );
    return;
  }

  // ── TESTLAR ──
  if (text === "📚 Testlar") {
    userState.set(from.id, { step: "choose_subject" });
    const usedCount = getDailySubjectCount(from.id);
    await bot.sendMessage(
      chatId,
      `📚 <b>Fanlar</b>\n\n` +
      `📅 Bugun ${usedCount}/${DAILY_SUBJECT_LIMIT} fan ishladingiz\n` +
      `⚠️ Kunlik limit: ${DAILY_SUBJECT_LIMIT} ta fan\n\n` +
      `Fan tanlang:`,
      { parse_mode: "HTML", ...subjectsKeyboard(from.id) }
    );
    return;
  }

  // ── ORQAGA ──
  if (text === "⬅️ Orqaga" || text === "❌ Bekor qilish") {
    userState.delete(from.id);
    await bot.sendMessage(chatId, "🏠 Asosiy menyu:", mainKeyboard(from || {}));
    return;
  }

  // ── FAN TANLASH ──
  if (state.step === "choose_subject") {
    const subject = subjects.find((s) => text.includes(s.name));
    if (!subject) {
      await bot.sendMessage(chatId, "Fan topilmadi, qaytadan tanlang:", subjectsKeyboard(from.id));
      return;
    }

    const testIdx = getSubjectTestIndex(from.id, subject.id);
    if (testIdx >= TESTS_PER_SUBJECT) {
      await bot.sendMessage(chatId, `✅ Bu fanning ${TESTS_PER_SUBJECT} ta testi bajarildi!\nErtaga davom eting.`, subjectsKeyboard(from.id));
      return;
    }

    const usedCount = getDailySubjectCount(from.id);
    const isNewSubjectToday = testIdx === 0;
    if (isNewSubjectToday && usedCount >= DAILY_SUBJECT_LIMIT) {
      await bot.sendMessage(chatId, `⚠️ Bugungi kunlik limit (${DAILY_SUBJECT_LIMIT} ta fan) to'ldi!\nErtaga davom eting.`, subjectsKeyboard(from.id));
      return;
    }

    const { question: q, questionIndex } = pickQuestionForAttempt(subject.id, testIdx);
    const startTime = Date.now();

    userState.set(from.id, {
      step: "answering",
      subject,
      qIndex: questionIndex,
      answer: q.answer,
      testIdx,
      startTime,
    });

    const opts = q.options.map((o, i) => [{ text: `${["A", "B", "C", "D"][i]}) ${o}` }]);
    opts.push([{ text: "⬅️ Orqaga" }]);

    const questionMsg = await bot.sendMessage(
      chatId,
      `${subject.emoji} <b>${esc(subject.name)}</b> | Test ${testIdx + 1}/${TESTS_PER_SUBJECT}\n\n` +
      `❓ <b>${esc(q.q)}</b>\n\n` +
      `⏱️ Qolgan vaqt: ${TEST_TIME_SECONDS} soniya`,
      {
        parse_mode: "HTML",
        reply_markup: { keyboard: opts, resize_keyboard: true },
      }
    );

    const countdownIntervalId = setInterval(async () => {
      const currentState = userState.get(from.id);
      if (!currentState || currentState.step !== "answering" || currentState.startTime !== startTime) {
        clearInterval(countdownIntervalId);
        return;
      }
      const elapsedSeconds = Math.floor((Date.now() - currentState.startTime) / 1000);
      const remain = Math.max(0, TEST_TIME_SECONDS - elapsedSeconds);
      try {
        await bot.editMessageText(
          `${subject.emoji} <b>${esc(subject.name)}</b> | Test ${testIdx + 1}/${TESTS_PER_SUBJECT}\n\n` +
          `❓ <b>${esc(q.q)}</b>\n\n` +
          `⏱️ Qolgan vaqt: ${remain} soniya`,
          {
            chat_id: chatId,
            message_id: questionMsg.message_id,
            parse_mode: "HTML",
          }
        );
      } catch (e) {}
      if (remain <= 0) clearInterval(countdownIntervalId);
    }, 1000);

    const timerId = setTimeout(async () => {
      const currentState = userState.get(from.id);
      if (currentState && currentState.step === "answering" && currentState.startTime === startTime) {
        stopActiveQuestionTimers(currentState);
        userState.delete(from.id);
        incrementSubjectTest(from.id, subject.id); 
        await bot.sendMessage(
          chatId,
          `⏰ <b>Vaqt tugadi!</b>\n\nTo'g'ri javob: <b>${esc(q.options[q.answer])}</b>\n\n💎 Olmos qo'shilmadi.`,
          { parse_mode: "HTML", ...subjectsKeyboard(from.id) }
        );
        userState.set(from.id, { step: "choose_subject" });
      }
    }, TEST_TIME_SECONDS * 1000);

    const newState = userState.get(from.id);
    if (newState) {
      newState.timerId = timerId;
      newState.countdownIntervalId = countdownIntervalId;
      newState.questionMessageId = questionMsg.message_id;
    }

    return;
  }

  // ── JAVOB TEKSHIRISH ──
  if (state.step === "answering") {
    stopActiveQuestionTimers(state);

    const elapsed = (Date.now() - state.startTime) / 1000;
    
    // Increment so user moves to next test even if time was technically over.
    // If > TEST_TIME_SECONDS we give false answer anyway.
    let outOfTime = elapsed > TEST_TIME_SECONDS;

    const { subject, answer, testIdx } = state;
    const { question: q } = pickQuestionForAttempt(subject.id, testIdx);
    
    incrementSubjectTest(from.id, subject.id);

    if (outOfTime) {
      userState.set(from.id, { step: "choose_subject" });
      await bot.sendMessage(chatId, "⏰ Vaqt tugadi! Olmos berilmadi.\nKeyingi fan tanlang:", subjectsKeyboard(from.id));
      return;
    }

    const answerLetters = ["A", "B", "C", "D"];
    const selectedIndex = answerLetters.findIndex((l) => text.startsWith(l + ")"));

    if (selectedIndex === -1) {
      await bot.sendMessage(chatId, "Variantlardan birini tanlang:");
      // We shouldn't increment if they sent arbitrary text. Let's revert!
      // But it's simple bot, so just cancel.
      userState.set(from.id, { step: "choose_subject" });
      return;
    }

    const isCorrect = selectedIndex === answer;

    if (isCorrect) {
      addDiamonds(from.id, 1);
      const updatedUser = dbData.users.find(u => u.id === from.id);
      await bot.sendMessage(
        chatId,
        `✅ <b>To'g'ri javob!</b>\n\n+1 💎 olmos qo'shildi!\n💎 Jami: <b>${updatedUser.diamonds}</b> olmos`,
        { parse_mode: "HTML" }
      );
    } else {
      await bot.sendMessage(
        chatId,
        `❌ <b>Noto'g'ri!</b>\n\nTo'g'ri javob: <b>${esc(q.options[answer])}</b>`,
        { parse_mode: "HTML" }
      );
    }

    const newTestIdx = testIdx + 1;
    if (newTestIdx >= TESTS_PER_SUBJECT) {
      userState.set(from.id, { step: "choose_subject" });
      await bot.sendMessage(
        chatId,
        `🎉 <b>${subject.emoji} ${esc(subject.name)}</b> fanidagi barcha testlar tugadi!\n\nBoshqa fan tanlang:`,
        { parse_mode: "HTML", ...subjectsKeyboard(from.id) }
      );
    } else {
      const { question: nextQ, questionIndex: nextQIndex } = pickQuestionForAttempt(subject.id, newTestIdx);
      const opts = nextQ.options.map((o, i) => [{ text: `${answerLetters[i]}) ${o}` }]);
      opts.push([{ text: "⬅️ Orqaga" }]);
      const startTime = Date.now();
      userState.set(from.id, {
        step: "answering",
        subject,
        qIndex: nextQIndex,
        answer: nextQ.answer,
        testIdx: newTestIdx,
        startTime,
      });

      const questionMsg = await bot.sendMessage(
        chatId,
        `${subject.emoji} <b>${esc(subject.name)}</b> | Test ${newTestIdx + 1}/${TESTS_PER_SUBJECT}\n\n` +
        `❓ <b>${esc(nextQ.q)}</b>\n\n` +
        `⏱️ Qolgan vaqt: ${TEST_TIME_SECONDS} soniya`,
        { parse_mode: "HTML", reply_markup: { keyboard: opts, resize_keyboard: true } }
      );

      const countdownIntervalId = setInterval(async () => {
        const currentState = userState.get(from.id);
        if (!currentState || currentState.step !== "answering" || currentState.startTime !== startTime) {
          clearInterval(countdownIntervalId);
          return;
        }
        const elapsedSeconds = Math.floor((Date.now() - currentState.startTime) / 1000);
        const remain = Math.max(0, TEST_TIME_SECONDS - elapsedSeconds);
        try {
          await bot.editMessageText(
            `${subject.emoji} <b>${esc(subject.name)}</b> | Test ${newTestIdx + 1}/${TESTS_PER_SUBJECT}\n\n` +
            `❓ <b>${esc(nextQ.q)}</b>\n\n` +
            `⏱️ Qolgan vaqt: ${remain} soniya`,
            {
              chat_id: chatId,
              message_id: questionMsg.message_id,
              parse_mode: "HTML",
            }
          );
        } catch (e) {}
        if (remain <= 0) clearInterval(countdownIntervalId);
      }, 1000);

      const timerId = setTimeout(async () => {
        const currentState = userState.get(from.id);
        if (currentState && currentState.step === "answering" && currentState.startTime === startTime) {
          stopActiveQuestionTimers(currentState);
          userState.delete(from.id);
          incrementSubjectTest(from.id, subject.id);
          await bot.sendMessage(
            chatId,
            `⏰ <b>Vaqt tugadi!</b>\n\nTo'g'ri javob: <b>${esc(nextQ.options[nextQ.answer])}</b>`,
            { parse_mode: "HTML", ...subjectsKeyboard(from.id) }
          );
          userState.set(from.id, { step: "choose_subject" });
        }
      }, TEST_TIME_SECONDS * 1000);

      const ns = userState.get(from.id);
      if (ns) {
        ns.timerId = timerId;
        ns.countdownIntervalId = countdownIntervalId;
        ns.questionMessageId = questionMsg.message_id;
      }
    }
    return;
  }

  // ── ADMIN PANEL ──
  if (text === "👑 Admin Panel" && from.username === ADMIN_USERNAME) {
    userState.delete(from.id);
    const total = dbData.users.length;
    const totalDiamonds = dbData.users.reduce((acc, u) => acc + u.diamonds, 0);
    const pending = dbData.withdrawals.filter(w => w.status === 'pending').length;
    const topUsers = [...dbData.users].sort((a,b) => b.diamonds - a.diamonds).slice(0, 5);
    const topList = topUsers.map((u, i) => `${i + 1}. ${esc(u.first_name)}${u.username ? " (@" + esc(u.username) + ")" : ""}: ${u.diamonds} 💎`).join("\n");

    await bot.sendMessage(
      from.id,
      `👑 <b>Admin boshqaruvi</b>\n\n` +
      `👥 Jami foydalanuvchilar: <b>${total}</b>\n` +
      `💎 Jami olmoslar: <b>${totalDiamonds}</b>\n` +
      `📋 Kutayotgan yechishlar: <b>${pending}</b>\n\n` +
      `🔧 <b>Qo'shimcha buyruqlar:</b>\n` +
      `/users - Top 20 foydalanuvchilar\n` +
      `/withdrawals - Kutayotgan so'rovlar\n` +
      `/add [ID] [MIQDOR] - Olmos qo'shish (Misol: /add 1234567 10)\n` +
      `/ayir [ID] [MIQDOR] - Olmos ayirish (Misol: /ayir 1234567 5)\n\n` +
      `🏆 <b>Eng faol 5 foydalanuvchi:</b>\n${esc(topList)}`,
      { parse_mode: "HTML", ...mainKeyboard(from) }
    );
    return;
  }

  // Default
  if (!state.step) {
    await bot.sendMessage(chatId, "Menyudan tanlang:", mainKeyboard(from || {}));
  }
});

// ─── ADMIN COMMANDS ───────────────────────────────────────
bot.onText(/\/admin/, async (msg) => {
  const from = msg.from;
  if (from.username !== ADMIN_USERNAME) return;

  const total = dbData.users.length;
  const totalDiamonds = dbData.users.reduce((acc, u) => acc + u.diamonds, 0);
  const pending = dbData.withdrawals.filter(w => w.status === 'pending').length;
  const topUsers = [...dbData.users].sort((a,b) => b.diamonds - a.diamonds).slice(0, 5);
  const topList = topUsers.map((u, i) => `${i + 1}. ${esc(u.first_name)}${u.username ? " (@" + esc(u.username) + ")" : ""}: ${u.diamonds} 💎`).join("\n");

  await bot.sendMessage(
    from.id,
    `👑 <b>Admin boshqaruvi</b>\n\n` +
    `👥 Jami foydalanuvchilar: <b>${total}</b>\n` +
    `💎 Jami olmoslar: <b>${totalDiamonds}</b>\n` +
    `📋 Kutayotgan yechishlar: <b>${pending}</b>\n\n` +
    `🏆 <b>Eng faol 5 foydalanuvchi:</b>\n${topList}`,
    { parse_mode: "HTML" }
  );
});

bot.onText(/\/users/, async (msg) => {
  const from = msg.from;
  if (from.username !== ADMIN_USERNAME) return;
  const users = [...dbData.users].sort((a,b) => b.diamonds - a.diamonds).slice(0, 20);
  const list = users.map((u, i) =>
    `${i + 1}. ${esc(u.first_name)}${u.username ? " (@" + esc(u.username) + ")" : ""}\n   💎 ${u.diamonds} | 👥 ${u.referral_count} referal | ID: ${u.id}`
  ).join("\n");
  await bot.sendMessage(from.id, `👥 <b>Foydalanuvchilar:</b>\n\n${list}`, { parse_mode: "HTML" });
});

bot.onText(/\/withdrawals/, async (msg) => {
  const from = msg.from;
  if (from.username !== ADMIN_USERNAME) return;
  
  const pending = dbData.withdrawals.filter(w => w.status === 'pending').slice(0, 10);
  if (!pending.length) {
    await bot.sendMessage(from.id, "📋 Kutayotgan so'rovlar yo'q.");
    return;
  }
  
  const list = pending.map((r, i) => {
     let u = dbData.users.find(x => x.id === r.user_id) || {};
     return `${i + 1}. ${esc(u.first_name)}${u.username ? " (@" + esc(u.username) + ")" : ""}\n   💎 ${r.amount} | Kod: ${r.code} | ID: ${r.user_id} | CMD: /approve_${r.id}`;
  }).join("\n\n");
  
  await bot.sendMessage(from.id, `📋 <b>Kutayotgan so'rovlar:</b>\n\n${list}`, { parse_mode: "HTML" });
});

bot.onText(/\/approve_(\d+)/, async (msg, match) => {
  const from = msg.from;
  if (from.username !== ADMIN_USERNAME) return;
  const wid = parseInt(match[1]);
  const w = dbData.withdrawals.find(x => x.id === wid);
  if (!w) {
    await bot.sendMessage(from.id, "So'rov topilmadi.");
    return;
  }
  dbData.withdrawals.find(x => x.id === wid).status = 'approved';
  saveDB();
  await bot.sendMessage(from.id, `✅ So'rov #${wid} tasdiqlandi.`);
  try {
    await bot.sendMessage(w.user_id, `✅ <b>${w.amount}</b> ta olmosni yechish so'rovingiz tasdiqlandi!\nAdmin siz bilan bog'lanadi.`, { parse_mode: "HTML" });
  } catch (e) {}
});

bot.onText(/\/(add|ayir) (\d+) (\d+)/, async (msg, match) => {
  const from = msg.from;
  if (from.username !== ADMIN_USERNAME) return;
  const action = match[1];
  const targetId = parseInt(match[2]);
  const amount = parseInt(match[3]);
  if (isNaN(targetId) || isNaN(amount)) return;
  
  const user = dbData.users.find(u => u.id === targetId);
  if (!user) {
    await bot.sendMessage(from.id, "❌ Bunday foydalanuvchi topilmadi.");
    return;
  }

  if (action === "add") {
    user.diamonds += amount;
    saveDB();
    await bot.sendMessage(from.id, `✅ Foydalanuvchiga (ID: ${targetId}) ${amount} olmos qo'shildi! Jami olmosi: ${user.diamonds}`);
    try {
      await bot.sendMessage(targetId, `🎁 Admin sizga <b>${amount}</b> olmos qo'shdi!\n💎 Jami olmosingiz: <b>${user.diamonds}</b>`, { parse_mode: "HTML" });
    } catch(e) {}
  } else if (action === "ayir") {
    if (user.diamonds < amount) {
      await bot.sendMessage(from.id, `❌ Foydalanuvchida buncha olmos yo'q. Faqat ${user.diamonds} bor.`);
      return;
    }
    user.diamonds -= amount;
    saveDB();
    await bot.sendMessage(from.id, `✅ Foydalanuvchidan (ID: ${targetId}) ${amount} olmos olib tashlandi! Jami olmosi: ${user.diamonds}`);
    try {
      await bot.sendMessage(targetId, `➖ Admin hisobingizdan <b>${amount}</b> olmos ayirib tashladi.\n💎 Jami olmosingiz: <b>${user.diamonds}</b>`, { parse_mode: "HTML" });
    } catch(e) {}
  }
});


// ─── START ────────────────────────────────────────────────
(async () => {
  await fetchBotUsername();
  console.log(`🤖 Bot ishga tushdi: @${botUsername}`);
  console.log("💎 Diamond Quiz Bot faol!");
})();

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.once("SIGINT", () => { bot.stopPolling(); process.exit(); });
process.once("SIGTERM", () => { bot.stopPolling(); process.exit(); });
