/**
 * Quotation system end-to-end test (pure functions + PDF generation).
 *
 * Usage: npx tsx scripts/test-quotations.ts
 *
 * Exercises:
 *   1. computeTotals — normal math, empty items, discount > subtotal clamp,
 *      negative / NaN inputs.
 *   2. quotationNumber / quotationFileName formatting.
 *   3. buildOrderFromQuotation — order field mapping, walk-in userId
 *      fallback, totals consistency, notes reference.
 *   4. buildServiceQuoteRequest — status/brand/service fields.
 *   5. generateQuotationPdf — real jsPDF output: valid %PDF header, ≥1 page,
 *      works with line items AND with an empty (to-be-priced) quotation.
 *
 * No Firestore, no network — safe to run anywhere.
 */
import type { Timestamp } from "firebase/firestore";
import type { Quotation, WithId } from "../lib/types";
import {
  buildOrderFromQuotation,
  buildServiceQuoteRequest,
  computeTotals,
  lineTotal,
  quotationFileName,
  quotationNumber,
} from "../lib/quotations";
import { generateQuotationPdf } from "../lib/quotation-pdf";

let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Fake Firestore Timestamp for the pure-function tests. */
const fakeTs = {
  toDate: () => new Date("2026-10-03T12:00:00+05:00"),
} as unknown as Timestamp;

function makeQuotation(overrides: Partial<Quotation> = {}): WithId<Quotation> {
  return {
    id: "9f3k2a1bxx99",
    customerName: "Ahmed Raza",
    phone: "03001234567",
    email: "ahmed@example.com",
    items: [
      { name: "SS Hinge 4 inch", qty: 10, unitPrice: 250 },
      { name: "Door lock set", qty: 2, unitPrice: 1850 },
    ],
    subtotal: 6200,
    discount: 200,
    tax: 0,
    total: 6000,
    status: "accepted",
    brand: "mtr",
    notes: "Delivery within 3 days.",
    createdAt: fakeTs,
    updatedAt: fakeTs,
    ...overrides,
  };
}

/* ------------------------------ 1. totals ------------------------------ */
console.log("\n1. computeTotals");
{
  const items = [
    { name: "A", qty: 10, unitPrice: 250 },
    { name: "B", qty: 2, unitPrice: 1850 },
  ];
  const t = computeTotals(items, 200, 0);
  check("subtotal = 6200", t.subtotal === 6200, `got ${t.subtotal}`);
  check("discount preserved", t.discount === 200);
  check("total = 6000", t.total === 6000, `got ${t.total}`);

  const withTax = computeTotals(items, 0, 500);
  check("tax added: total = 6700", withTax.total === 6700, `got ${withTax.total}`);

  const empty = computeTotals([], 0, 0);
  check("empty items → zeros", empty.subtotal === 0 && empty.total === 0);

  const over = computeTotals(items, 99999, 0);
  check("discount > subtotal clamps to 0", over.total === 0, `got ${over.total}`);

  const nasty = computeTotals(
    [{ name: "X", qty: -3, unitPrice: NaN }],
    -50,
    Number.POSITIVE_INFINITY
  );
  check(
    "negative/NaN/Infinity inputs sanitized",
    nasty.subtotal === 0 && nasty.discount === 0 && nasty.tax === 0 && nasty.total === 0,
    JSON.stringify(nasty)
  );

  check("lineTotal 10×250 = 2500", lineTotal({ name: "A", qty: 10, unitPrice: 250 }) === 2500);
}

/* ---------------------------- 2. identifiers ---------------------------- */
console.log("\n2. quotationNumber / quotationFileName");
{
  check(
    "QT number format",
    quotationNumber("9f3k2a1bxx99") === "QT-9F3K2A1B",
    quotationNumber("9f3k2a1bxx99")
  );
  check(
    "PDF filename",
    quotationFileName("9f3k2a1bxx99") === "htc-quotation-QT-9F3K2A1B.pdf",
    quotationFileName("9f3k2a1bxx99")
  );
}

/* ------------------------- 3. convert to order ------------------------- */
console.log("\n3. buildOrderFromQuotation");
{
  const q = makeQuotation();
  const order = buildOrderFromQuotation(q);

  check("brand carried over", order.brand === "mtr");
  check("walk-in userId fallback", order.userId === "walk-in");
  check("2 order items", order.items.length === 2);
  check(
    "item mapping (name/qty/price)",
    order.items[0]?.name === "SS Hinge 4 inch" &&
      order.items[0]?.qty === 10 &&
      order.items[0]?.price === 250
  );
  check(
    "totals recomputed from items",
    order.subtotal === 6200 && order.discount === 200 && order.total === 6000,
    `subtotal=${order.subtotal} total=${order.total}`
  );
  check("status Pending / COD", order.status === "Pending" && order.paymentMethod === "COD");
  check("shipping 0", order.shipping === 0);
  check(
    "address from customer contact",
    order.address.name === "Ahmed Raza" && order.address.phone === "03001234567"
  );
  check(
    "notes reference the QT number",
    (order.notes ?? "").includes("QT-9F3K2A1B"),
    order.notes
  );

  const signed = makeQuotation({ userId: "uid-123" });
  check(
    "signed-in userId preserved",
    buildOrderFromQuotation(signed).userId === "uid-123"
  );

  const htc = makeQuotation({ brand: "htc", items: [], subtotal: 0, total: 0 });
  const htcOrder = buildOrderFromQuotation(htc);
  check("empty HTC quote → empty items, zero total", htcOrder.items.length === 0 && htcOrder.total === 0);
}

/* ----------------------- 4. service quote request ----------------------- */
console.log("\n4. buildServiceQuoteRequest");
{
  const r = buildServiceQuoteRequest({
    serviceId: "svc-1",
    serviceName: "2BHK Interior",
    customerName: "  Sara Khan ",
    phone: "03219876543",
    email: "sara@example.com",
    notes: "Need it in a month",
    userId: "uid-9",
  });
  check("status sent", r.status === "sent");
  check("brand htc", r.brand === "htc");
  check("service linked", r.serviceId === "svc-1" && r.serviceName === "2BHK Interior");
  check("name trimmed", r.customerName === "Sara Khan");
  check("zero totals", r.total === 0 && r.subtotal === 0);
  check("userId kept", r.userId === "uid-9");

  const anon = buildServiceQuoteRequest({
    serviceId: "svc-1",
    serviceName: "2BHK Interior",
    customerName: "Walk In",
    phone: "03000000000",
  });
  check("optional fields omitted when empty", anon.email === undefined && anon.userId === undefined);
}

/* ------------------------------ 5. PDF gen ------------------------------ */
async function testPdfGen() {
  console.log("\n5. generateQuotationPdf");
  {
    const withItems = makeQuotation();
    const doc = await generateQuotationPdf(withItems, {
      siteName: "Hammer Trading Company",
      phone: "0300 1234567",
    });
    const buf = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);
    check("PDF header %PDF", buf.subarray(0, 4).toString() === "%PDF");
    check("≥1 page", doc.getNumberOfPages() >= 1, `${doc.getNumberOfPages()} pages`);
    check("non-trivial size", buf.length > 3000, `${buf.length} bytes`);

    const emptyQuote = makeQuotation({
      id: "empty0001",
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      brand: "htc",
      serviceName: "2BHK Interior",
      status: "sent",
    });
    const doc2 = await generateQuotationPdf(emptyQuote);
    const buf2 = Buffer.from(doc2.output("arraybuffer") as ArrayBuffer);
    check(
      "empty (to-be-priced) quotation renders",
      buf2.subarray(0, 4).toString() === "%PDF" && doc2.getNumberOfPages() >= 1
    );
  }
}

async function main() {
  await testPdfGen();

  /* -------------------------------- summary -------------------------------- */
  console.log("");
  if (failures > 0) {
    console.error(`❌ ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("🎉 All quotation tests passed.");
}

void main();
