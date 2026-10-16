import { Container, Skeleton } from "@/components/ui/layout-primitives";

export default function Loading() {
  return (
    <Container className="py-10" aria-busy="true">
      <Skeleton className="mb-4 h-9 w-1/2" />
      <Skeleton className="mb-8 h-5 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </Container>
  );
}
