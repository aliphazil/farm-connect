import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      {icon ? (
        <div aria-hidden="true" className="mb-4 text-4xl">
          {icon}
        </div>
      ) : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
