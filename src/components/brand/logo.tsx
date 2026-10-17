import Link from "next/link";
import { cn } from "@/lib/cn";

/** Leaf over a wave: farming + islands. Inherits the brand colours. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className={cn("size-9 shrink-0", className)}
    >
      <rect width="40" height="40" rx="10" className="fill-primary" />
      <path
        d="M20 27c-5.5-1.6-8-5.7-7.4-12.8 6.9-.3 10.6 2.6 11.4 8.4"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M20 27c.4-5.6 3.2-9.2 8.6-10.4"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M8 31.5c2.7-1.6 5.3-1.6 8 0s5.3 1.6 8 0 5.3-1.6 8 0"
        fill="none"
        stroke="white"
        strokeOpacity=".85"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  href,
  name,
  className,
}: {
  href: string;
  name: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 rounded-lg", className)}
    >
      <LogoMark />
      <span className="text-lg leading-tight font-bold text-primary">
        {name}
      </span>
    </Link>
  );
}
