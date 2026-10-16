"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  href: string;
  children: ReactNode;
  /** Match only the exact path; otherwise sub-paths count as active too. */
  exact?: boolean;
  className?: string;
};

/**
 * Link that marks itself aria-current="page" when active. Falls back to an
 * inactive link where the pathname is only known at request time.
 */
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<StyledLink {...props} active={false} />}>
      <NavLinkWithPath {...props} />
    </Suspense>
  );
}

function NavLinkWithPath(props: Props) {
  const pathname = usePathname();
  const active = props.exact
    ? pathname === props.href
    : pathname === props.href || pathname.startsWith(`${props.href}/`);
  return <StyledLink {...props} active={active} />;
}

function StyledLink({
  href,
  children,
  className,
  active,
}: Props & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted hover:bg-primary-soft hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
