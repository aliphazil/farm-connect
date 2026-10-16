import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Container, PageHeader } from "@/components/ui/layout-primitives";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.marketplace.title };
}

// Listings, search and atoll/island filters arrive in Phase 4.
export default async function MarketplacePage() {
  const dict = await getDictionary();
  return (
    <Container className="py-10">
      <PageHeader
        title={dict.marketplace.title}
        description={dict.marketplace.intro}
      />
      <EmptyState
        icon="🥬"
        title={dict.marketplace.emptyTitle}
        description={dict.marketplace.emptyBody}
      />
    </Container>
  );
}
