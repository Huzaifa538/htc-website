/**
 * Server-side bot jawab — /api/chat/messages se call hota hai.
 *
 * Jab customer message bhejta hai aur bot active ho to ye
 * function foran FAQ jawab nikaal kar bhej deta hai.
 * Sawal mein Urdu lafz hon to Urdu jawab, warna English.
 */

// [lang, keywords, answer] — pehla match jeetta hai
const RULES: Array<[string, string[], { en: string; ur: string }]> = [
  [
    "delivery",
    ["deliver", "shipping", "ship", "پہنچ", "کب آئے", "کتنے دن", "پہنچے", "ڈیلیور"],
    {
      en: "We deliver nationwide across Pakistan. Orders above PKR 50,000 get FREE delivery! Standard delivery takes 2-4 working days.",
      ur: "ہم پورے پاکستان میں ڈیلیور کرتے ہیں۔ 50,000 روپے سے اوپر کے آرڈر پر ڈیلیوری بالکل مفت! عام ڈیلیوری میں 2-4 کام کے دن لگتے ہیں۔",
    },
  ],
  [
    "returns",
    ["return", "refund", "exchange", "واپس", "تبدیل"],
    {
      en: "Easy 7-day return policy. If the product is unused and in original packing, we'll exchange or refund it. Just contact us on WhatsApp.",
      ur: "آسان 7 دن کی واپسی پالیسی۔ اگر چیز استعمال نہ ہوئی ہو اور اصل پیکنگ میں ہو تو ہم تبدیل یا واپس کر دیں گے۔ بس واٹس ایپ پر رابطہ کریں۔",
    },
  ],
  [
    "payment",
    ["payment", "pay", "cod", "cash", "jazzcash", "easypaisa", "card", "ادائیگی", "پیسے"],
    {
      en: "We accept Cash on Delivery (COD), bank transfer, JazzCash and Easypaisa. Card payments coming soon.",
      ur: "کیش آن ڈیلیوری، بینک ٹرانسفر، جاز کیش اور ایزی پیسہ قبول کرتے ہیں۔ کارڈ کی ادائیگی جلد آ رہی ہے۔",
    },
  ],
  [
    "timings",
    ["timing", "time", "open", "close", "hour", "ٹائم", "کھلا", "بند", "اوقات"],
    {
      en: "Our shop is open Monday to Saturday, 9:00 AM to 9:00 PM. Closed on Sundays.",
      ur: "ہماری دکان پیر سے ہفتہ، صبح 9 سے رات 9 بجے تک کھلی رہتی ہے۔ اتوار کو بند۔",
    },
  ],
  [
    "contact",
    ["contact", "phone", "number", "whatsapp", "رابطہ", "فون", "نمبر"],
    {
      en: "You can reach us on WhatsApp: +92 321 2476150. We usually reply within an hour during shop hours.",
      ur: "واٹس ایپ پر رابطہ کریں: +92 321 2476150۔ دکان کے اوقات میں عام طور پر ایک گھنٹے میں جواب دیتے ہیں۔",
    },
  ],
  [
    "location",
    ["location", "address", "shop", "store", "where", "پتہ", "دکان", "کہاں"],
    {
      en: "We're Hammer Trading Company — visit our shop or order online, we deliver all over Pakistan.",
      ur: "ہم ہیمر ٹریڈنگ کمپنی ہیں — ہماری دکان تشریف لائیں یا آن لائن آرڈر کریں، ہم پورے پاکستان میں ڈیلیور کرتے ہیں۔",
    },
  ],
  [
    "price",
    ["price", "cost", "rate", "قیمت", "دام"],
    {
      en: "Prices are listed on each product page. For bulk orders or special rates, message us on WhatsApp and we'll give you our best price.",
      ur: "قیمتیں ہر پروڈکٹ کے صفحے پر لکھی ہیں۔ بڑے آرڈر یا خاص رعایت کے لیے واٹس ایپ پر میسج کریں، بہترین قیمت دیں گے۔",
    },
  ],
  [
    "greeting",
    ["salam", "assalam", "hello", "hi", "hey", "aoa", "السلام", "آداب"],
    {
      en: "Hello! Welcome to Hammer Trading Company. How can I help you today?",
      ur: "السلام علیکم! ہیمر ٹریڈنگ کمپنی میں خوش آمدید۔ میں آپ کی کیا مدد کر سکتا ہوں؟",
    },
  ],
  [
    "thanks",
    ["thank", "shukriya", "شکریہ"],
    {
      en: "You're welcome! Anything else I can help with?",
      ur: "خوش آمدید! کچھ اور پوچھنا ہو تو بتائیں۔",
    },
  ],
];

const URDU_HINT = /[\u0600-\u06FF]/;

/** Sawal ka jawab nikalo. null = bot ko nahi pata. */
export function findBotAnswer(question: string): string | null {
  const s = question.toLowerCase().trim();
  if (!s) return null;
  const preferUrdu = URDU_HINT.test(question);
  for (const [, words, ans] of RULES) {
    if (words.some((w) => s.includes(w))) {
      return preferUrdu ? ans.ur : ans.en;
    }
  }
  return null;
}

/** Bot ko jawab nahi aaya to ye fallback bhejta hai. */
export function botFallback(preferUrdu: boolean): string {
  return preferUrdu
    ? "معذرت، اس کا جواب میرے پاس نہیں۔ ہماری ٹیم جلد رابطہ کرے گی، یا واٹس ایپ پر پوچھیں: +92 321 2476150"
    : "Sorry, I don't have an answer for that. Our team will get back to you soon — or ask us on WhatsApp: +92 321 2476150";
}
