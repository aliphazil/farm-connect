import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { localeHref } from "@/i18n/paths";
import { cn } from "@/lib/cn";
import { SearchIcon } from "@/components/ui/icons";

/**
 * Product search. A plain GET form to the products page, so it works without
 * JavaScript. `id` must be unique on the page.
 */
export function SearchForm({
  locale,
  dict,
  id,
  size = "md",
  defaultValue,
  className,
}: {
  locale: Locale;
  dict: Dictionary;
  id: string;
  size?: "md" | "lg";
  defaultValue?: string;
  className?: string;
}) {
  return (
    <form
      role="search"
      action={localeHref(locale, "/products")}
      method="get"
      className={cn("flex w-full", className)}
    >
      <label htmlFor={id} className="sr-only">
        {dict.search.label}
      </label>
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={dict.search.placeholder}
          maxLength={80}
          enterKeyHint="search"
          className={cn(
            "w-full rounded-s-lg border border-e-0 border-border bg-surface ps-10 pe-3 text-foreground placeholder:text-muted/80 focus:border-primary",
            size === "lg" ? "min-h-13 text-lg" : "min-h-11 text-base",
          )}
        />
      </div>
      <button
        type="submit"
        className={cn(
          "rounded-e-lg bg-primary px-4 font-semibold text-white hover:bg-primary-hover",
          size === "lg" ? "min-h-13 px-6 text-lg" : "min-h-11",
        )}
      >
        {dict.search.submit}
      </button>
    </form>
  );
}
