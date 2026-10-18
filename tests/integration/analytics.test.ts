import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import type { AnalyticsBatch, AnalyticsEvent } from "@shared/schemas";
import { maldivesDayBoundary } from "@shared/utils/date";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getClientAuth } from "@/lib/firebase/client";
import { perAddress, perVisitor } from "@/lib/analytics-limits";
import {
  clearAnalyticsCaches,
  getFarmerAnalytics,
  getSiteAnalytics,
  recordEvents,
  type Viewer,
} from "@/services/server/analytics";
import { POST } from "@/app/api/events/route";

/**
 * Marketplace analytics against the emulators: validation, de-duplication,
 * aggregation accuracy, Maldives-time day boundaries, unique visitors across
 * ranges, figures from source records, farmer data isolation, the intake
 * endpoint's protections and read cost.
 *
 * Events are recorded with fixed dates in 2030 so these counters don't mix
 * with anything else in the emulator.
 */

const db = () => getAdminDb();
const RUN = randomUUID().slice(0, 8);
const FARMER_A = `an-farmer-a-${RUN}`;
const FARMER_B = `an-farmer-b-${RUN}`;
const P_A1 = `an-pa1-${RUN}`;
const P_A2 = `an-pa2-${RUN}`;
const P_B1 = `an-pb1-${RUN}`;
const P_PRIVATE = `an-ppriv-${RUN}`;
const ISLAND = `an-island-${RUN}`;

/** 10:00 Maldives time on a 2030 day. */
const at = (day: string, hhmm = "10:00") => new Date(`${day}T${hhmm}:00+05:00`);
const range = (from: string, to: string) => ({
  from: maldivesDayBoundary(from, "start")!,
  to: maldivesDayBoundary(to, "end")!,
});
const vid = () => randomUUID().replace(/-/g, "");

let seeded: FirebaseFirestore.DocumentReference[] = [];
async function seed(collection: string, id: string, data: object) {
  const ref = db().collection(collection).doc(id);
  await ref.set(data);
  seeded.push(ref);
  return ref;
}

function send(
  events: AnalyticsEvent[],
  {
    v = vid(),
    s = vid(),
    newDay = false,
    newSession = false,
    now = at("2030-01-10"),
    viewer = null as Viewer,
  } = {},
) {
  const batch: AnalyticsBatch = { v, s, newDay, newSession, events };
  return recordEvents(batch, { now, viewer });
}

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Run through `npm run test:emulator`");
  await seed(COLLECTIONS.islands, ISLAND, {
    atollCode: "AA",
    nameEn: "Analytics Island",
    nameDv: "",
    active: true,
  });
  for (const [id, approval] of [
    [FARMER_A, "approved"],
    [FARMER_B, "approved"],
  ])
    await seed(COLLECTIONS.farmerProfiles, id, {
      approvalStatus: approval,
      visible: true,
    });
  const product = (farmerId: string, title: string, isPublic = true) => ({
    farmerId,
    title: { en: title, dv: "" },
    category: "fruits",
    location: { atollCode: "AA", islandId: ISLAND },
    isPublic,
  });
  await seed(COLLECTIONS.products, P_A1, product(FARMER_A, "Papaya A"));
  await seed(COLLECTIONS.products, P_A2, {
    ...product(FARMER_A, "Chillies A"),
    category: "vegetables",
  });
  await seed(COLLECTIONS.products, P_B1, product(FARMER_B, "Melon B"));
  await seed(
    COLLECTIONS.products,
    P_PRIVATE,
    product(FARMER_A, "Draft", false),
  );
});

beforeEach(() => {
  clearAnalyticsCaches();
  perAddress.reset();
  perVisitor.reset();
});

afterAll(async () => {
  await Promise.all(seeded.map((r) => r.delete()));
  seeded = [];
  await signOut(getClientAuth()).catch(() => undefined);
});

describe("visitors, sessions and page views", () => {
  it("counts page views every time but a refreshing visitor only once", async () => {
    const day = "2030-01-01";
    const v = vid();
    const s = vid();
    const pv = { type: "page_view", path: "/en/products" } as const;
    await send([pv], { v, s, newDay: true, newSession: true, now: at(day) });
    // Refreshes; a client wrongly repeating the "new" flags doesn't count twice.
    await send([pv, pv], {
      v,
      s,
      newDay: true,
      newSession: true,
      now: at(day),
    });
    await send([pv], { v, s, now: at(day, "11:00") });
    // A second browser.
    await send([pv], { newDay: true, newSession: true, now: at(day) });

    const a = await getSiteAnalytics(range(day, day));
    expect(a.totals.pageViews).toBe(5);
    expect(a.totals.sessions).toBe(2);
    expect(a.totals.visitors).toBe(2);
    expect(a.uniqueVisitors).toEqual({ value: 2, exact: true });
  });

  it("estimates unique visitors across days, counting returning visitors once", async () => {
    const people = Array.from({ length: 40 }, vid);
    const days = ["2030-01-03", "2030-01-04", "2030-01-05"];
    // Day 1: people 0–19, day 2: 10–29, day 3: 20–39 → 40 distinct, 60 visitor-days.
    for (const [i, day] of days.entries())
      for (const v of people.slice(i * 10, i * 10 + 20))
        await send([{ type: "page_view", path: "/en" }], {
          v,
          newDay: true,
          now: at(day),
        });
    const single = await getSiteAnalytics(range(days[1], days[1]));
    expect(single.uniqueVisitors).toEqual({ value: 20, exact: true });
    const all = await getSiteAnalytics(range(days[0], days[2]));
    expect(all.totals.visitors).toBe(60); // visitor-days
    expect(all.uniqueVisitors.exact).toBe(false);
    expect(Math.abs(all.uniqueVisitors.value - 40)).toBeLessThanOrEqual(1);
  });

  it("refuses portal pages and malformed paths at validation", async () => {
    const { analyticsBatchSchema } = await import("@shared/schemas");
    const ok = (path: string) =>
      analyticsBatchSchema.safeParse({
        v: vid(),
        s: vid(),
        events: [{ type: "page_view", path }],
      }).success;
    expect(ok("/en/products")).toBe(true);
    expect(ok("/dv")).toBe(true);
    expect(ok("/en/admin/analytics")).toBe(false);
    expect(ok("/en/farmer")).toBe(false);
    expect(ok("/en/account/invoices")).toBe(false);
    expect(ok("https://evil.example/")).toBe(false);
    expect(ok("/en/<script>")).toBe(false);
  });
});

describe("marketplace events", () => {
  const day = "2030-01-10";

  it("counts each visitor once per product per day, with farmer/category/island from the product", async () => {
    const v1 = vid();
    const view = (productId: string) =>
      ({ type: "product_view", productId }) as const;
    expect(await send([view(P_A1)], { v: v1 })).toEqual({
      counted: 1,
      duplicates: 0,
      ignored: 0,
    });
    expect((await send([view(P_A1)], { v: v1 })).duplicates).toBe(1);
    await send([view(P_A1)]); // another visitor
    await send([view(P_A2)], { v: v1 });
    await send([view(P_B1)], { v: v1 });
    // Not public or doesn't exist: ignored.
    expect((await send([view(P_PRIVATE)])).ignored).toBe(1);
    expect((await send([view("no-such-product")])).ignored).toBe(1);
    // Same visitor the next day counts again (on that day).
    await send([view(P_A1)], { v: v1, now: at("2030-01-11") });

    const a = await getSiteAnalytics(range(day, day));
    expect(a.totals.productViews).toBe(4);
    expect(a.topProducts[0]).toMatchObject({ id: P_A1, views: 2 });
    expect(a.topProducts[0].name?.en).toBe("Papaya A");
    expect(a.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fruits", views: 3 }),
        expect.objectContaining({ id: "vegetables", views: 1 }),
      ]),
    );
    expect(a.islands[0]).toMatchObject({ id: ISLAND, views: 4 });
    expect(a.islands[0].name?.en).toBe("Analytics Island");
    const two = await getSiteAnalytics(range(day, "2030-01-11"));
    expect(two.totals.productViews).toBe(5);
  });

  it("counts contact clicks per channel; a click isn't an enquiry", async () => {
    const v = vid();
    const click = (channel: "call" | "whatsapp" | "viber") =>
      ({ type: "contact_click", channel, productId: P_A1 }) as const;
    await send([click("whatsapp")], { v });
    expect((await send([click("whatsapp")], { v })).duplicates).toBe(1);
    await send([click("call")], { v });
    // Farm page button (no product).
    await send([
      { type: "contact_click", channel: "viber", farmerId: FARMER_A },
    ]);
    // A farmer id that doesn't own the product is refused.
    expect(
      (
        await send([
          {
            type: "contact_click",
            channel: "call",
            productId: P_A1,
            farmerId: FARMER_B,
          },
        ])
      ).ignored,
    ).toBe(1);

    const a = await getSiteAnalytics(range(day, day));
    expect(a.totals).toMatchObject({
      contactClicks: 3,
      contactWhatsapp: 1,
      contactCall: 1,
      contactViber: 1,
    });
    expect(a.enquiries).toBe(0);
  });

  it("records searches and filters without storing the words", async () => {
    const v = vid();
    await send([{ type: "search", q: "Papaya", noResults: false }], { v });
    expect(
      (
        await send([{ type: "search", q: "  papaya ", noResults: false }], {
          v,
        })
      ).duplicates,
    ).toBe(1);
    await send([{ type: "search", q: "durian", noResults: true }], { v });
    await send(
      [{ type: "filter", category: "fruits", atoll: "AA", island: ISLAND }],
      { v },
    );
    expect(
      (await send([{ type: "filter", island: "no-such-island" }])).ignored,
    ).toBe(1);

    const a = await getSiteAnalytics(range(day, day));
    expect(a.totals.searches).toBe(2);
    expect(a.totals.searchesNoResults).toBe(1);
    expect(a.totals.filterUses).toBe(3);
    expect(a.atollFilters).toEqual([{ id: "AA", count: 1 }]);
    const shards = await db()
      .collection(COLLECTIONS.analyticsDaily)
      .doc(day)
      .collection("shards")
      .get();
    expect(JSON.stringify(shards.docs.map((d) => d.data()))).not.toMatch(
      /papaya|durian/i,
    );
  });

  it("leaves out admins and farmers looking at their own listings", async () => {
    const d = "2030-01-12";
    const admin: Viewer = { uid: "an-admin", role: "admin" };
    expect(
      await send(
        [
          { type: "page_view", path: "/en" },
          { type: "product_view", productId: P_A1 },
        ],
        { viewer: admin, newDay: true, newSession: true, now: at(d) },
      ),
    ).toEqual({ counted: 0, duplicates: 0, ignored: 2 });
    const farmerA: Viewer = { uid: FARMER_A, role: "farmer" };
    expect(
      (
        await send([{ type: "product_view", productId: P_A1 }], {
          viewer: farmerA,
          now: at(d),
        })
      ).ignored,
    ).toBe(1);
    expect(
      (
        await send([{ type: "farmer_view", farmerId: FARMER_A }], {
          viewer: farmerA,
          now: at(d),
        })
      ).ignored,
    ).toBe(1);
    // Farmer A looking at someone else's listing counts.
    expect(
      (
        await send([{ type: "product_view", productId: P_B1 }], {
          viewer: farmerA,
          now: at(d),
        })
      ).counted,
    ).toBe(1);
    const a = await getSiteAnalytics(range(d, d));
    expect(a.totals).toMatchObject({
      pageViews: 0,
      visitors: 0,
      productViews: 1,
    });
  });
});

describe("Maldives time", () => {
  it("puts events on the Maldives calendar day, not the UTC one", async () => {
    const pv = { type: "page_view", path: "/en" } as const;
    // 23:59:59 on 20 Jan in Malé (18:59:59 UTC) …
    await send([pv], { now: new Date("2030-01-20T18:59:59Z") });
    // … and 00:00 on 21 Jan in Malé (19:00 UTC, still 20 Jan in UTC).
    await send([pv, pv], { now: new Date("2030-01-20T19:00:00Z") });
    expect(
      (await getSiteAnalytics(range("2030-01-20", "2030-01-20"))).totals
        .pageViews,
    ).toBe(1);
    const next = await getSiteAnalytics(range("2030-01-21", "2030-01-21"));
    expect(next.totals.pageViews).toBe(2);
    expect(next.series.map((p) => p.day)).toEqual(["2030-01-21"]);
  });
});

describe("figures from the records themselves", () => {
  const W = "2030-02-0";
  it("counts enquiries, registrations, invoices, payments and reports in the period exactly", async () => {
    const inside = at(`${W}2`);
    const outside = at("2030-02-20");
    const n = () => `an-${RUN}-${randomUUID().slice(0, 6)}`;
    await seed(COLLECTIONS.enquiries, n(), {
      farmerId: FARMER_A,
      productId: P_A1,
      createdAt: inside,
    });
    await seed(COLLECTIONS.enquiries, n(), {
      farmerId: FARMER_A,
      productId: P_A1,
      createdAt: at(`${W}3`),
    });
    await seed(COLLECTIONS.enquiries, n(), {
      farmerId: FARMER_B,
      productId: P_B1,
      createdAt: inside,
    });
    await seed(COLLECTIONS.enquiries, n(), {
      farmerId: FARMER_A,
      productId: P_A2,
      createdAt: outside,
    });
    for (const role of ["farmer", "consumer", "consumer", "admin"])
      await seed(COLLECTIONS.users, n(), { role, createdAt: inside });
    await seed(COLLECTIONS.users, n(), { role: "farmer", createdAt: outside });
    for (const [status, totalLaari] of [
      ["issued", 10_000],
      ["paid", 25_050],
      ["cancelled", 99_900],
    ] as const)
      await seed(COLLECTIONS.invoices, n(), {
        status,
        totalLaari,
        issuedAt: inside,
      });
    for (const [kind, amountLaari, verificationStatus] of [
      ["payment", 20_000, "verified"],
      ["payment", 5_050, "pending_verification"],
      ["payment", 1_000, "recorded"],
      ["payment", 700, "rejected"],
      ["refund", 300, "recorded"],
    ] as const)
      await seed(COLLECTIONS.payments, n(), {
        kind,
        amountLaari,
        verificationStatus,
        createdAt: inside,
      });
    await seed(COLLECTIONS.reports, n(), {
      reason: "fraud_scam",
      status: "resolved",
      createdAt: inside,
      closedAt: at(`${W}4`),
    });
    await seed(COLLECTIONS.reports, n(), {
      reason: "fake_listing",
      status: "open",
      createdAt: at(`${W}3`),
    });
    await seed(COLLECTIONS.enforcementActions, n(), {
      type: "warning",
      createdAt: inside,
    });

    const a = await getSiteAnalytics(range(`${W}1`, `${W}7`));
    expect(a.enquiries).toBe(3);
    expect(a.activeFarmers?.withEnquiries).toBe(2);
    expect(a.registrations).toEqual({ farmers: 1, consumers: 2 });
    expect(a.invoices).toEqual({ count: 2, totalLaari: 35_050, cancelled: 1 });
    expect(a.payments).toEqual({
      count: 4,
      totalLaari: 26_750,
      verifiedLaari: 20_000,
      pendingLaari: 5_050,
      rejectedLaari: 700,
      refundsLaari: 300,
      reversalsLaari: 0,
    });
    expect(a.reports).toMatchObject({ opened: 2, closed: 1 });
    expect(a.reports?.byReason).toEqual(
      expect.arrayContaining([
        { id: "fraud_scam", count: 1 },
        { id: "fake_listing", count: 1 },
      ]),
    );
    expect(a.reports?.enforcement).toEqual([{ id: "warning", count: 1 }]);
    const day2 = a.series.find((p) => p.day === `${W}2`)!;
    expect(day2).toMatchObject({ enquiries: 2, farmers: 1, consumers: 2 });
    expect(a.topProducts).toEqual([]);
  });
});

describe("farmer analytics", () => {
  it("shows a farmer only their own listings and farm page", async () => {
    const d = "2030-03-01";
    await send(
      [
        { type: "product_view", productId: P_A1 },
        { type: "product_view", productId: P_B1 },
        { type: "farmer_view", farmerId: FARMER_A },
        { type: "contact_click", channel: "whatsapp", productId: P_A1 },
      ],
      { now: at(d) },
    );
    await send(
      [
        { type: "product_view", productId: P_A2 },
        { type: "product_view", productId: P_A1 },
      ],
      { now: at("2030-03-02") },
    );
    await seed(COLLECTIONS.enquiries, `an-${RUN}-fa1`, {
      farmerId: FARMER_A,
      productId: P_A1,
      createdAt: at(d),
    });
    await seed(COLLECTIONS.enquiries, `an-${RUN}-fb1`, {
      farmerId: FARMER_B,
      productId: P_B1,
      createdAt: at(d),
    });

    const a = await getFarmerAnalytics(FARMER_A, range(d, "2030-03-02"));
    expect(a.totals).toEqual({
      productViews: 3,
      profileViews: 1,
      contactClicks: 1,
      contactCall: 0,
      contactWhatsapp: 1,
      contactViber: 0,
      enquiries: 1,
    });
    expect(a.products.map((p) => p.id)).toEqual([P_A1, P_A2]);
    expect(a.products[0]).toMatchObject({ views: 2, clicks: 1, enquiries: 1 });
    expect(JSON.stringify(a)).not.toContain(P_B1);
    expect(a.series).toEqual([
      {
        day: d,
        productViews: 1,
        profileViews: 1,
        contactClicks: 1,
        enquiries: 1,
      },
      {
        day: "2030-03-02",
        productViews: 2,
        profileViews: 0,
        contactClicks: 0,
        enquiries: 0,
      },
    ]);

    const b = await getFarmerAnalytics(FARMER_B, range(d, "2030-03-02"));
    expect(b.totals).toMatchObject({ productViews: 1, enquiries: 1 });
    expect(b.products.map((p) => p.id)).toEqual([P_B1]);
  });
});

describe("POST /api/events", () => {
  const request = (
    body: unknown,
    headers: Record<string, string> = {},
  ): Request =>
    new Request("http://localhost:3000/api/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000",
        "x-forwarded-for": "203.0.113.7",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  const batch = (events: AnalyticsEvent[], v = vid()) => ({
    v,
    s: vid(),
    events,
  });
  const pv = { type: "page_view", path: "/en" } as const;

  it("accepts a valid same-origin batch", async () => {
    const res = await POST(request(batch([pv])));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ counted: 1, duplicates: 0, ignored: 0 });
  });

  it("refuses other sites, bad input and oversized bodies; ignores bots", async () => {
    expect(
      (await POST(request(batch([pv]), { origin: "https://evil.example" })))
        .status,
    ).toBe(403);
    expect((await POST(request("not json"))).status).toBe(400);
    expect(
      (await POST(request(batch([{ type: "purchase" } as never])))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({ ...batch([pv]), counts: { pageViews: 1_000_000 } }),
        )
      ).status,
    ).toBe(200); // unknown fields are dropped, never applied
    expect((await POST(request(batch(Array(6).fill(pv))))).status).toBe(400);
    expect((await POST(request("x".repeat(5000)))).status).toBe(400);
    expect(
      (
        await POST(
          request(batch([pv]), {
            "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
          }),
        )
      ).status,
    ).toBe(204);
  });

  it("rate-limits one browser and one address", async () => {
    const v = vid();
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++)
      statuses.push((await POST(request(batch([pv], v)))).status);
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(60)).toEqual([429, 429]);

    perVisitor.reset();
    perAddress.reset();
    const fromOne: number[] = [];
    for (let i = 0; i < 122; i++)
      fromOne.push(
        (
          await POST(
            request(batch([pv]), { "x-forwarded-for": "198.51.100.9" }),
          )
        ).status,
      );
    expect(fromOne.filter((s) => s === 429)).toHaveLength(2);
  });

  it("doesn't count an admin's browsing (from the session cookie)", async () => {
    const email = `an-admin-${randomUUID()}@example.test`;
    const { uid } = await getAdminAuth().createUser({
      email,
      password: "correct-horse-battery",
    });
    await getAdminAuth().setCustomUserClaims(uid, {
      role: "admin",
      adminLevel: "moderator",
    });
    const { user } = await signInWithEmailAndPassword(
      getClientAuth(),
      email,
      "correct-horse-battery",
    );
    const cookie = await getAdminAuth().createSessionCookie(
      await user.getIdToken(true),
      { expiresIn: 3600_000 },
    );
    const res = await POST(
      request(batch([pv]), { cookie: `__session=${cookie}` }),
    );
    expect(await res.json()).toEqual({ counted: 0, duplicates: 0, ignored: 1 });
  });
});

describe("read cost", () => {
  it("reads a fixed number of counter documents per day, however busy", async () => {
    const t0 = Date.now();
    const a = await getSiteAnalytics(range("2029-12-12", "2030-01-10"));
    const ms = Date.now() - t0;
    expect(a.days).toHaveLength(30);
    expect(a.docsRead).toBe(30 * 5 * 2);
    expect(ms).toBeLessThan(10_000);
  });
});
