import { Container } from "@/components/ui/layout-primitives";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <Container className="flex justify-center py-12 sm:py-20">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </Container>
  );
}
