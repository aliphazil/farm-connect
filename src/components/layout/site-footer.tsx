import type { Dictionary } from "@shared/i18n";
import { Container } from "@/components/ui/layout-primitives";

export function SiteFooter({ dict }: { dict: Dictionary }) {
  return (
    <footer className="mt-auto border-t border-border bg-surface py-8 text-sm text-muted">
      <Container className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <p>
          © {dict.meta.siteName}. {dict.footer.rights}
        </p>
        <p>{dict.footer.noOnlinePayments}</p>
      </Container>
    </footer>
  );
}
