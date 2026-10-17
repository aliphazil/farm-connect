import { Skeleton } from "@/components/ui/layout-primitives";
import { Spinner } from "@/components/ui/spinner";

/** Shown while an admin page loads its data. */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Spinner label="Loading" />
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
