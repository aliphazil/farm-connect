import type { Dictionary } from "@shared/i18n";
import { Alert } from "@/components/ui/alert";

/** Shown on every page that displays sample catalog data. */
export function SampleDataNotice({
  dict,
  className,
}: {
  dict: Dictionary;
  className?: string;
}) {
  return (
    <Alert tone="warning" title={dict.sample.title} className={className}>
      {dict.sample.body}
    </Alert>
  );
}
