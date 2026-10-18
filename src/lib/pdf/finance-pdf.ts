import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LedgerSummary } from "@shared/ledger";
import type { Invoice, PaymentRecord, Receipt } from "@shared/schemas";
import { dictionaries } from "@shared/i18n";
import { formatMVR } from "@shared/utils/money";

/**
 * Invoice and receipt PDFs (A4), generated on the server with embedded fonts:
 * Inter for Latin text and Noto Sans Thaana for Dhivehi (both SIL OFL; see
 * src/lib/pdf/fonts/LICENSE). Labels are in English; names and item titles
 * keep their Dhivehi text, drawn right-to-left.
 */

const FONT_DIR = join(process.cwd(), "src/lib/pdf/fonts");
const t = dictionaries.en.finance;
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 48;
const INK = rgb(0.1, 0.12, 0.1);
const MUTED = rgb(0.4, 0.43, 0.4);
const LINE = rgb(0.85, 0.87, 0.85);
const GREEN = rgb(0.08, 0.5, 0.24);

type Fonts = { regular: PDFFont; bold: PDFFont; thaana: PDFFont };

let fontBytes: Promise<[Buffer, Buffer, Buffer]> | null = null;
function loadFontBytes() {
  fontBytes ??= Promise.all([
    readFile(join(FONT_DIR, "inter-latin-400-normal.woff")),
    readFile(join(FONT_DIR, "inter-latin-700-normal.woff")),
    readFile(join(FONT_DIR, "noto-sans-thaana-thaana-400-normal.woff")),
  ]);
  return fontBytes;
}

async function newDoc(title: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [r, b, th] = await loadFontBytes();
  const fonts: Fonts = {
    regular: await doc.embedFont(r, { subset: true }),
    bold: await doc.embedFont(b, { subset: true }),
    thaana: await doc.embedFont(th, { subset: true }),
  };
  doc.setTitle(title);
  doc.setProducer("FarmConnect Maldives");
  doc.setCreator("FarmConnect Maldives");
  return { doc, fonts };
}

// ---------------------------------------------------------------------------
// Text runs: Latin and Thaana in their own fonts, Dhivehi right-to-left.
// ---------------------------------------------------------------------------

const THAANA = /[\u0780-\u07BF]/;
const THAANA_MARK = /[\u07A6-\u07B0]/;
/** Thaana glyphs look small next to Latin at the same size. */
const THAANA_SCALE = 1.2;

type Run = { text: string; thaana: boolean };

/** Splits into script runs; Thaana runs are reversed by cluster for drawing. */
function visualRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (const ch of text) {
    const isThaana =
      THAANA.test(ch) || (ch === " " && runs.at(-1)?.thaana === true);
    const last = runs.at(-1);
    if (last && last.thaana === isThaana) last.text += ch;
    else runs.push({ text: ch, thaana: isThaana });
  }
  const rtl = runs.some((r) => r.thaana);
  const out = runs.map((r) => {
    if (!r.thaana) return r;
    // Keep each consonant with its vowel mark, then reverse the clusters.
    const clusters: string[] = [];
    for (const ch of r.text) {
      if (THAANA_MARK.test(ch) && clusters.length)
        clusters[clusters.length - 1] += ch;
      else clusters.push(ch);
    }
    return { text: clusters.reverse().join(""), thaana: true };
  });
  return rtl ? out.reverse() : out;
}

/** Characters the Latin font can draw (others become "?"). */
function latinSafe(s: string) {
  return s.replace(
    /[^\u0020-\u007E\u00A0-\u024F\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u20AC]/g,
    "?",
  );
}

function widthOf(text: string, size: number, fonts: Fonts, bold = false) {
  return visualRuns(text).reduce(
    (w, r) =>
      w +
      (r.thaana
        ? fonts.thaana
        : bold
          ? fonts.bold
          : fonts.regular
      ).widthOfTextAtSize(
        r.thaana ? r.text : latinSafe(r.text),
        r.thaana ? size * THAANA_SCALE : size,
      ),
    0,
  );
}

function draw(
  page: PDFPage,
  fonts: Fonts,
  text: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    align?: "left" | "right";
  } = {},
) {
  const size = opts.size ?? 10;
  let cx =
    opts.align === "right" ? x - widthOf(text, size, fonts, opts.bold) : x;
  for (const r of visualRuns(text)) {
    const font = r.thaana
      ? fonts.thaana
      : opts.bold
        ? fonts.bold
        : fonts.regular;
    const s = r.thaana ? r.text : latinSafe(r.text);
    const runSize = r.thaana ? size * THAANA_SCALE : size;
    page.drawText(s, {
      x: cx,
      y,
      size: runSize,
      font,
      color: opts.color ?? INK,
    });
    cx += font.widthOfTextAtSize(s, runSize);
  }
}

/** Word-wraps to a width; returns lines. */
function wrap(
  text: string,
  width: number,
  size: number,
  fonts: Fonts,
): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (widthOf(next, size, fonts) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

const money = (laari: number) => formatMVR(laari, "en");
const date = (d?: Date) =>
  d
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Indian/Maldives",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d)
    : "—";
const nameOf = (n?: { en?: string; dv?: string }) =>
  n ? n.en || n.dv || "" : "";

function footer(page: PDFPage, fonts: Fonts, lines: string[]) {
  let y = MARGIN + 12 * (lines.length - 1);
  for (const l of lines) {
    for (const w of wrap(l, A4.w - 2 * MARGIN, 7.5, fonts)) {
      draw(page, fonts, w, MARGIN, y, { size: 7.5, color: MUTED });
      y -= 10;
    }
  }
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export async function renderInvoicePdf(
  invoice: Invoice,
  ledger: PaymentRecord[],
  summary: LedgerSummary,
): Promise<Uint8Array> {
  const title = invoice.number ? `${t.invoice} ${invoice.number}` : t.invoice;
  const { doc, fonts } = await newDoc(title);
  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;
  const right = A4.w - MARGIN;
  const status = dictionaries.en.invoiceStatus[invoice.status];

  const newPageIfNeeded = (need: number) => {
    if (y - need < MARGIN + 60) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN;
    }
  };

  draw(page, fonts, t.invoice.toUpperCase(), MARGIN, y - 18, {
    size: 22,
    bold: true,
    color: GREEN,
  });
  draw(page, fonts, invoice.number ?? t.draft, right, y - 8, {
    size: 11,
    bold: true,
    align: "right",
  });
  draw(page, fonts, `${t.status}: ${status}`, right, y - 24, {
    size: 9,
    color: MUTED,
    align: "right",
  });
  y -= 52;

  // Parties.
  const col2 = A4.w / 2 + 10;
  draw(page, fonts, t.seller, MARGIN, y, { size: 8, color: MUTED });
  draw(page, fonts, t.buyer, col2, y, { size: 8, color: MUTED });
  y -= 14;
  const seller = [
    nameOf(invoice.sellerName),
    invoice.sellerPlace,
    invoice.sellerPhone,
  ].filter(Boolean) as string[];
  const buyer = [
    invoice.buyerName,
    invoice.buyerPlace,
    invoice.buyerPhone,
  ].filter(Boolean) as string[];
  for (let i = 0; i < Math.max(seller.length, buyer.length); i++) {
    if (seller[i])
      draw(page, fonts, seller[i], MARGIN, y, { size: 10, bold: i === 0 });
    if (buyer[i])
      draw(page, fonts, buyer[i], col2, y, { size: 10, bold: i === 0 });
    y -= 14;
  }
  y -= 6;
  draw(page, fonts, `${t.issueDate}: ${date(invoice.issuedAt)}`, MARGIN, y, {
    size: 9,
  });
  draw(page, fonts, `${t.dueDate}: ${date(invoice.dueAt)}`, col2, y, {
    size: 9,
  });
  y -= 24;

  // Lines.
  const cols = { item: MARGIN, qty: 330, unit: 375, price: 470, amount: right };
  const header = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: right - MARGIN,
      height: 18,
      color: rgb(0.94, 0.96, 0.94),
    });
    draw(page, fonts, t.item, cols.item + 4, y + 1, { size: 8.5, bold: true });
    draw(page, fonts, t.qty, cols.qty, y + 1, {
      size: 8.5,
      bold: true,
      align: "right",
    });
    draw(page, fonts, t.unit, cols.unit, y + 1, { size: 8.5, bold: true });
    draw(page, fonts, t.unitPrice, cols.price, y + 1, {
      size: 8.5,
      bold: true,
      align: "right",
    });
    draw(page, fonts, t.amount, cols.amount - 4, y + 1, {
      size: 8.5,
      bold: true,
      align: "right",
    });
    y -= 22;
  };
  header();
  for (const line of invoice.lines) {
    const titleLines = wrap(
      nameOf(line.title),
      cols.qty - cols.item - 60,
      9.5,
      fonts,
    );
    newPageIfNeeded(14 * titleLines.length + 6);
    titleLines.forEach((l, i) =>
      draw(page, fonts, l, cols.item + 4, y - i * 13, { size: 9.5 }),
    );
    draw(page, fonts, String(line.quantity), cols.qty, y, {
      size: 9.5,
      align: "right",
    });
    draw(page, fonts, dictionaries.en.units[line.unit], cols.unit, y, {
      size: 9.5,
    });
    draw(page, fonts, money(line.unitPriceLaari), cols.price, y, {
      size: 9.5,
      align: "right",
    });
    draw(page, fonts, money(line.totalLaari), cols.amount - 4, y, {
      size: 9.5,
      align: "right",
    });
    const lineY = y - 13 * (titleLines.length - 1) - 6;
    page.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: right, y: lineY },
      thickness: 0.5,
      color: LINE,
    });
    y = lineY - 14;
  }

  // Totals.
  newPageIfNeeded(120);
  y -= 6;
  const total = (label: string, value: string, bold = false) => {
    draw(page, fonts, label, 330, y, { size: bold ? 10.5 : 9.5, bold });
    draw(page, fonts, value, right - 4, y, {
      size: bold ? 10.5 : 9.5,
      bold,
      align: "right",
    });
    y -= bold ? 18 : 14;
  };
  total(t.subtotal, money(invoice.subtotalLaari));
  if (invoice.discountLaari)
    total(t.discount, `- ${money(invoice.discountLaari)}`);
  total(t.delivery, money(invoice.deliveryFeeLaari));
  total(t.total, money(invoice.totalLaari), true);
  total(t.paid, money(summary.netPaidLaari));
  if (summary.refundedLaari) total(t.refunded, money(summary.refundedLaari));
  total(t.outstanding, money(summary.outstandingLaari), true);
  if (summary.pendingLaari)
    draw(
      page,
      fonts,
      t.pendingNote.replace("{amount}", money(summary.pendingLaari)),
      right - 4,
      y,
      {
        size: 8,
        color: MUTED,
        align: "right",
      },
    );
  y -= 18;

  // Terms and notes.
  for (const [label, value] of [
    [t.terms, invoice.paymentTerms],
    [t.notes, invoice.notes],
  ] as const) {
    if (!value) continue;
    const lines = wrap(value, right - MARGIN, 9, fonts);
    newPageIfNeeded(16 + lines.length * 12);
    draw(page, fonts, label, MARGIN, y, { size: 8.5, bold: true });
    y -= 13;
    for (const l of lines) {
      draw(page, fonts, l, MARGIN, y, { size: 9 });
      y -= 12;
    }
    y -= 6;
  }

  // Payments.
  const shown = ledger.filter((e) => e.kind !== "reversal");
  if (shown.length) {
    newPageIfNeeded(40);
    draw(page, fonts, t.payments, MARGIN, y, { size: 10, bold: true });
    y -= 16;
    for (const e of shown) {
      newPageIfNeeded(16);
      const st = e.reversed
        ? dictionaries.en.paymentStatus.reversed
        : dictionaries.en.paymentStatus[e.verificationStatus];
      draw(page, fonts, date(e.receivedAt), MARGIN, y, { size: 8.5 });
      draw(
        page,
        fonts,
        `${dictionaries.en.ledgerKinds[e.kind]} · ${dictionaries.en.paymentMethods[e.method]}${e.reference ? ` · ${e.reference}` : ""}`,
        MARGIN + 80,
        y,
        { size: 8.5 },
      );
      draw(page, fonts, st, 340, y, { size: 8.5, color: MUTED });
      draw(
        page,
        fonts,
        `${e.kind === "refund" ? "- " : ""}${money(e.amountLaari)}`,
        right - 4,
        y,
        { size: 8.5, align: "right" },
      );
      y -= 13;
    }
  }

  for (const p of doc.getPages())
    footer(p, fonts, [t.currencyNote, t.noTax, t.disclaimer]);
  return doc.save();
}

// ---------------------------------------------------------------------------
// Receipt
// ---------------------------------------------------------------------------

export async function renderReceiptPdf(
  receipt: Receipt,
  payment: PaymentRecord,
  invoice: Invoice,
): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc(`${t.receipt} ${receipt.number}`);
  const page = doc.addPage([A4.w, A4.h / 2]);
  let y = A4.h / 2 - MARGIN;
  const right = A4.w - MARGIN;
  const refund = receipt.kind === "refund";
  const status = payment.reversed
    ? dictionaries.en.paymentStatus.reversed
    : dictionaries.en.paymentStatus[payment.verificationStatus];

  draw(
    page,
    fonts,
    (refund ? dictionaries.en.ledgerKinds.refund : t.receipt).toUpperCase(),
    MARGIN,
    y - 16,
    { size: 20, bold: true, color: GREEN },
  );
  draw(page, fonts, receipt.number, right, y - 6, {
    size: 11,
    bold: true,
    align: "right",
  });
  draw(
    page,
    fonts,
    t.receiptFor.replace("{number}", invoice.number ?? "—"),
    right,
    y - 22,
    { size: 9, color: MUTED, align: "right" },
  );
  y -= 52;

  const rows: [string, string][] = [
    [refund ? t.refundTo : t.receivedFrom, invoice.buyerName],
    [t.paidTo, nameOf(invoice.sellerName)],
    ...(invoice.sellerPlace
      ? ([["", invoice.sellerPlace]] as [string, string][])
      : []),
    [t.paymentDate, date(payment.receivedAt)],
    [t.method, dictionaries.en.paymentMethods[payment.method]],
    ...(payment.reference
      ? ([[t.reference, payment.reference]] as [string, string][])
      : []),
    [t.receiptStatus, status],
  ];
  for (const [k, v] of rows) {
    draw(page, fonts, k, MARGIN, y, { size: 9, color: MUTED });
    draw(page, fonts, v, MARGIN + 130, y, { size: 10 });
    y -= 16;
  }
  y -= 14;
  page.drawRectangle({
    x: MARGIN,
    y: y - 8,
    width: right - MARGIN,
    height: 28,
    color: rgb(0.94, 0.96, 0.94),
  });
  draw(page, fonts, t.amount, MARGIN + 8, y, { size: 11, bold: true });
  draw(
    page,
    fonts,
    `${refund ? "- " : ""}${money(receipt.amountLaari)}`,
    right - 8,
    y,
    { size: 13, bold: true, align: "right" },
  );
  y -= 34;
  if (payment.reversed)
    draw(page, fonts, t.reversedNote, MARGIN, y, {
      size: 9,
      color: rgb(0.7, 0.1, 0.1),
    });

  footer(page, fonts, [t.currencyNote, t.disclaimer]);
  return doc.save();
}
