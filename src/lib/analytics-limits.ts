import "server-only";

import { createRateLimiter } from "./rate-limit";

/** Analytics intake limits (per server instance; see ./rate-limit.ts). */
export const perAddress = createRateLimiter({ limit: 120, windowMs: 60_000 });
export const perVisitor = createRateLimiter({ limit: 60, windowMs: 60_000 });
