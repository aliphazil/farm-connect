import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  info: "border-info/30 bg-info/5 text-info",
  success: "border-success/30 bg-success/5 text-success",
  warning: "border-warning/30 bg-warning/5 text-warning",
  error: "border-danger/30 bg-danger/5 text-danger",
};

/**
 * Inline message. Errors use role="alert" (announced immediately); other tones
 * use role="status" (announced politely).
 */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        tones[tone],
        className,
      )}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? (
        <div className={cn(title ? "mt-1" : undefined, "text-foreground")}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
