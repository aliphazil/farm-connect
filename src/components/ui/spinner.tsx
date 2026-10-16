import { cn } from "@/lib/cn";

export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      className="inline-flex items-center gap-2"
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-4 animate-spin rounded-full border-2 border-current border-e-transparent",
          className,
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
