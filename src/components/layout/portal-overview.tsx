import { Badge, Card, PageHeader } from "@/components/ui/layout-primitives";

/**
 * Placeholder dashboard listing a portal's upcoming sections. Cards become
 * links (and get sidebar entries) as each section is built.
 */
export function PortalOverview({
  title,
  sections,
  comingSoonLabel,
}: {
  title: string;
  sections: readonly string[];
  comingSoonLabel: string;
}) {
  return (
    <>
      <PageHeader title={title} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((label) => (
          <li key={label}>
            <Card className="h-full">
              <h2 className="font-semibold">{label}</h2>
              <Badge className="mt-3">{comingSoonLabel}</Badge>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
