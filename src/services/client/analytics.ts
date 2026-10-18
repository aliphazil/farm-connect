import { SESSION_IDLE_MS, type AnalyticsEvent } from "@shared/schemas";
import { maldivesDay } from "@shared/utils/date";

/**
 * Browser side of marketplace analytics (definitions:
 * shared/schemas/analytics.ts). Keeps a random visitor id and session id in
 * this browser's local storage — no cookies, nothing tied to an account —
 * and posts small batches to /api/events, which validates, deduplicates and
 * counts them. Failures are ignored: analytics must never break a page.
 */

const KEY = "fc:analytics";

type State = {
  /** Random visitor id. */
  v: string;
  /** Random session id and last activity time. */
  s: string;
  t: number;
  /** Maldives day the session started and the last day the visitor was reported. */
  sd: string;
  vd: string;
};

const randomId = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

let memoryState: State | null = null;

function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (typeof s.v === "string" && typeof s.s === "string") return s;
    }
  } catch {
    // Storage blocked: fall back to memory (counts once per page load).
  }
  return memoryState;
}

function save(state: State) {
  memoryState = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore.
  }
}

/** Updates visitor/session state; says whether this is a new day or session. */
function touch(now = Date.now()) {
  const today = maldivesDay(new Date(now));
  let state = load();
  let newSession = false;
  if (!state) {
    state = { v: randomId(), s: randomId(), t: now, sd: today, vd: "" };
    newSession = true;
  } else if (now - state.t > SESSION_IDLE_MS || state.sd !== today) {
    state = { ...state, s: randomId(), sd: today };
    newSession = true;
  }
  const newDay = state.vd !== today;
  state = { ...state, t: now, vd: today };
  save(state);
  return { v: state.v, s: state.s, newDay, newSession };
}

const queue: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  while (queue.length) {
    const events = queue.splice(0, 5);
    const body = JSON.stringify({ ...touch(), events });
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  }
}

/** Queues an event; sent shortly after (events on one page share a request). */
export function track(event: AnalyticsEvent) {
  if (typeof window === "undefined") return;
  queue.push(event);
  if (!timer) timer = setTimeout(flush, 300);
}

/** Sends queued events now (e.g. before following a contact link). */
export function trackNow(event: AnalyticsEvent) {
  track(event);
  if (timer) clearTimeout(timer);
  flush();
}

/** True once per browser session for `key` (cuts repeat requests). */
export function oncePerSession(key: string): boolean {
  try {
    const k = `fc:once:${key}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, "1");
  } catch {
    // Storage unavailable: let the server deduplicate.
  }
  return true;
}
