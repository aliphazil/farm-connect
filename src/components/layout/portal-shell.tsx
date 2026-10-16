import { Suspense, type ReactNode } from "react";
import { Container, Skeleton } from "@/components/ui/layout-primitives";
import { Spinner } from "@/components/ui/spinner";
import { NavLink } from "./nav-link";

type PortalNavItem = { href: string; label: string; exact?: boolean };

/**
 * Shared chrome for the farmer, buyer and admin portals.
 *
 * This shell does NOT check access. Each portal page calls its guard from
 * src/lib/auth/portal-access.ts, every Server Action re-verifies with
 * assertRole, and Security Rules guard the database. The Suspense boundary
 * here shows a loading state while a page's access check runs.
 */
export function PortalShell({
  title,
  navLabel,
  items,
  checkingLabel,
  children,
}: {
  title: string;
  navLabel: string;
  items: readonly PortalNavItem[];
  checkingLabel: string;
  children: ReactNode;
}) {
  return (
    <Container className="py-6 lg:py-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <aside className="lg:w-56 lg:shrink-0">
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">
            {title}
          </p>
          {/* Horizontal scrolling tabs on mobile, sidebar on desktop. */}
          <nav
            aria-label={navLabel}
            className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0"
          >
            <ul className="flex gap-1 lg:flex-col">
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    exact={item.exact}
                    className="block"
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <section className="min-w-0 flex-1">
          <Suspense fallback={<PortalLoading label={checkingLabel} />}>
            {children}
          </Suspense>
        </section>
      </div>
    </Container>
  );
}

function PortalLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-muted">
        <Spinner label={label} />
        <span aria-hidden="true">{label}</span>
      </p>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
