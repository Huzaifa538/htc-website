/**
 * Server-side bot jawab — /api/chat/messages se call hota hai.
 *
 * Do bots:
 * - HTC (purple): services, interior design, consultation, projects
 * - MTR (blue): products, shopping, orders, delivery
 *
 * Sawal mein Urdu lafz hon to Urdu jawab, warna English.
 */
import type { ChatBrand } from "./types";

type Answer = { en: string; ur: string };
type Rule = [string, string[], Answer];

/* ------------------------- MTR Store (products) ------------------------- */

const MTR_RULES: Rule[] = [
  [
    "delivery",
    ["deliver", "shipping", "ship", "track", "order status", "پہنچ", "کب آئے", "کتنے دن", "پہنچے", "ڈیلیور", "آرڈر"],
    {
      en: "We deliver nationwide across Pakistan. Orders above PKR 50,000 get FREE delivery! Standard delivery takes 2-4 working days. Share your order number on WhatsApp (+92 321 2476150) and we'll share the tracking.",
      ur: "ہم پورے پاکستان میں ڈیلیور کرتے ہیں۔ 50,000 روپے سے اوپر کے آرڈر پر ڈیلیوری بالکل مفت! عام ڈیلیوری میں 2-4 کام کے دن لگتے ہیں۔ اپنا آرڈر نمبر واٹس ایپ (+92 321 2476150) پر بھیجیں، ٹریکنگ بتا دیں گے۔",
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
    "price",
    ["price", "cost", "rate", "discount", "offer", "قیمت", "دام", "رعایت"],
    {
      en: "Prices are listed on each product page. For bulk orders or special rates, message us on WhatsApp and we'll give you our best price.",
      ur: "قیمتیں ہر پروڈکٹ کے صفحے پر لکھی ہیں۔ بڑے آرڈر یا خاص رعایت کے لیے واٹس ایپ پر میسج کریں، بہترین قیمت دیں گے۔",
    },
  ],
  [
    "product",
    ["product", "item", "stock", "available", "quality", "warranty", "پروڈکٹ", "چیز", "اسٹاک", "معیار"],
    {
      en: "All 111 hardware products are genuine quality stock. Check the product page for specs, or tell me which product you're looking for and I'll guide you.",
      ur: "تمام 111 ہارڈویئر پروڈکٹس اصلی معیار کے ہیں۔ تفصیل پروڈکٹ کے صفحے پر دیکھیں، یا بتائیں کونسی چیز چاہیے، رہنمائی کرتا ہوں۔",
    },
  ],
  [
    "greeting",
    ["salam", "assalam", "hello", "hi", "hey", "aoa", "السلام", "آداب"],
    {
      en: "Hello! Welcome to MTR Store. Looking for hardware? Ask me about delivery, prices, or any product!",
      ur: "السلام علیکم! ایم ٹی آر اسٹور میں خوش آمدید۔ ہارڈویئر چاہیے؟ ڈیلیوری، قیمت یا کسی پروڈکٹ کے بارے میں پوچھیں!",
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

/* --------------------- HTC (services / interior) --------------------- */

const HTC_RULES: Rule[] = [
  [
    "services",
    ["service", "services", "offer", "what do you do", "سروس", "خدمت", "کام"],
    {
      en: "HTC offers interior design, custom woodwork, complete home/office renovation, and hardware supply. Tell us about your project and we'll plan it together!",
      ur: "ایچ ٹی سی انٹیریئر ڈیزائن، لکڑی کا کام، گھر/دفتر کی مکمل تزئین و آرائش اور ہارڈویئر فراہم کرتا ہے۔ اپنے پروجیکٹ کے بارے میں بتائیں، مل کر پلان بناتے ہیں!",
    },
  ],
  [
    "consultation",
    ["consult", "appointment", "book", "visit", "meeting", "مشورہ", "اپائنٹمنٹ", "بک"],
    {
      en: "You can book a free consultation from our Services page — pick a date and time that suits you, and our designer will call you back. Or WhatsApp us directly: +92 321 2476150.",
      ur: "آپ سروسز والے صفحے سے مفت مشورے کے لیے وقت بک کر سکتے ہیں — اپنی سہولت کی تاریخ اور وقت چنیں، ہمارا ڈیزائنر آپ کو کال کرے گا۔ یا سیدھا واٹس ایپ کریں: +92 321 2476150۔",
    },
  ],
  [
    "projects",
    ["project", "portfolio", "work", "gallery", "previous", "پروجیکٹ", "کام", "نمونہ"],
    {
      en: "Check our Portfolio page to see completed interior projects — homes, offices, and shops across Pakistan. Every project is done with our own hardware and woodwork.",
      ur: "مکمل انٹیریئر پروجیکٹس دیکھنے کے لیے ہمارا پورٹ فولیو صفحہ دیکھیں — پاکستان بھر میں گھر، دفاتر اور دکانیں۔ ہر پروجیکٹ ہمارے اپنے ہارڈویئر اور لکڑی کے کام سے تیار ہوتا ہے۔",
    },
  ],
  [
    "timings",
    ["timing", "time", "open", "close", "hour", "ٹائم", "کھلا", "بند", "اوقات"],
    {
      en: "Our office is open Monday to Saturday, 9:00 AM to 9:00 PM. Site visits are scheduled by appointment.",
      ur: "ہمارا دفتر پیر سے ہفتہ، صبح 9 سے رات 9 بجے تک کھلا رہتا ہے۔ سائٹ کا دورہ اپائنٹمنٹ سے طے ہوتا ہے۔",
    },
  ],
  [
    "contact",
    ["contact", "phone", "number", "whatsapp", "رابطہ", "فون", "نمبر"],
    {
      en: "You can reach HTC on WhatsApp: +92 321 2476150. For project discussions we usually reply within an hour during office hours.",
      ur: "واٹس ایپ پر ایچ ٹی سی سے رابطہ کریں: +92 321 2476150۔ پروجیکٹ کی بات چیت کے لیے دفتر کے اوقات میں عام طور پر ایک گھنٹے میں جواب دیتے ہیں۔",
    },
  ],
  [
    "greeting",
    ["salam", "assalam", "hello", "hi", "hey", "aoa", "السلام", "آداب"],
    {
      en: "Hello! Welcome to HTC — Hammer Trading Company. Ask me about our interior services, booking a consultation, or our past projects!",
      ur: "السلام علیکم! ایچ ٹی سی — ہیمر ٹریڈنگ کمپنی میں خوش آمدید۔ ہماری انٹیریئر سروسز، مشورے کی بکنگ یا پرانے پروجیکٹس کے بارے میں پوچھیں!",
    },
  ],
  [
    "thanks",
    ["thank", "shukriya", "شکریہ"],
    {
      en: "You're welcome! Anything else about our services?",
      ur: "خوش آمدید! ہماری سروسز کے بارے میں کچھ اور پوچھنا ہو؟",
    },
  ],
];

const URDU_HINT = /[\u0600-\u06FF]/;

/** Brand ke hisaab se sawal ka jawab nikalo. null = bot ko nahi pata. */
export function findBotAnswer(
  question: string,
  brand: ChatBrand = "mtr"
): string | null {
  const s = question.toLowerCase().trim();
  if (!s) return null;
  const preferUrdu = URDU_HINT.test(question);
  const rules = brand === "htc" ? HTC_RULES : MTR_RULES;
  for (const [, words, ans] of rules) {
    if (words.some((w) => s.includes(w))) {
      return preferUrdu ? ans.ur : ans.en;
    }
  }
  return null;
}

/** Bot ko jawab nahi aaya to ye fallback bhejta hai. */
export function botFallback(brand: ChatBrand, preferUrdu: boolean): string {
  if (brand === "htc") {
    return preferUrdu
      ? "معذرت، اس کا جواب میرے پاس نہیں۔ ہماری ٹیم جلد رابطہ کرے گی، یا واٹس ایپ پر پوچھیں: +92 321 2476150"
      : "Sorry, I don't have an answer for that. Our team will get back to you soon — or ask us on WhatsApp: +92 321 2476150";
  }
  return preferUrdu
    ? "معذرت، اس کا جواب میرے پاس نہیں۔ ہماری ٹیم جلد رابطہ کرے گی، یا واٹس ایپ پر پوچھیں: +92 321 2476150"
    : "Sorry, I don't have an answer for that. Our team will get back to you soon — or ask us on WhatsApp: +92 321 2476150";
}
