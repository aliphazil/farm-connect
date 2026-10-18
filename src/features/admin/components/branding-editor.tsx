"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { PRODUCT_CATEGORIES } from "@shared/constants/catalog";
import { LOCALES, LOCALE_LABEL, type Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import {
  BRANDING_IMAGE_LIMITS,
  BUTTON_STYLES,
  CARD_STYLES,
  FONT_CHOICES,
  HEADING_WEIGHTS,
  SOCIAL_PLATFORMS,
  contrastRatio,
  type SiteConfig,
  type SocialPlatform,
} from "@shared/schemas";
import { storageObjectUrl } from "@/features/catalog/images";
import { uploadBrandingImage } from "@/services/client/uploads";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form-field";
import { saveBrandingDraftAction } from "../actions";
import { BrandingPublishControls } from "./branding-publish";

type T = Dictionary["admin"]["branding"];
type Text = { en: string; dv: string };
const TABS = ["identity", "theme", "home", "footer", "languages"] as const;
type Tab = (typeof TABS)[number];

/** Two inputs for an English/Dhivehi text. */
function TextPair({
  label,
  value,
  onChange,
  t,
  multiline,
  hint,
  max,
}: {
  label: string;
  value: Text;
  onChange: (v: Text) => void;
  t: T;
  multiline?: boolean;
  hint?: string;
  max: number;
}) {
  const id = useId();
  const Field = multiline ? TextAreaField : TextField;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{label}</legend>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`${id}-en`}
          name={`${id}-en`}
          label={t.fields.en}
          value={value.en}
          maxLength={max}
          onChange={(e) => onChange({ ...value, en: e.target.value })}
          {...(multiline ? { rows: 3 } : {})}
        />
        <Field
          id={`${id}-dv`}
          name={`${id}-dv`}
          label={t.fields.dv}
          value={value.dv}
          maxLength={max}
          dir="rtl"
          onChange={(e) => onChange({ ...value, dv: e.target.value })}
          {...(multiline ? { rows: 3 } : {})}
        />
      </div>
    </fieldset>
  );
}

/** Upload or remove one branding image. */
let carryOver: { tab: Tab; text: string } | null = null;

function ImageField({
  label,
  hint,
  path,
  onChange,
  favicon,
  t,
}: {
  label: string;
  hint: string;
  path?: string;
  onChange: (path: string | undefined) => void;
  favicon?: boolean;
  t: T;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function pick(file?: File) {
    if (!file) return;
    const types: readonly string[] = favicon
      ? [...BRANDING_IMAGE_LIMITS.faviconTypes, ...BRANDING_IMAGE_LIMITS.types]
      : BRANDING_IMAGE_LIMITS.types;
    const max = favicon
      ? BRANDING_IMAGE_LIMITS.faviconBytes
      : BRANDING_IMAGE_LIMITS.bytes;
    if (!types.includes(file.type) || file.size > max) return setError(true);
    setError(false);
    setBusy(true);
    try {
      onChange(await uploadBrandingImage(file));
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {path ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded branding image
          <img
            src={storageObjectUrl(path)}
            alt=""
            className="h-14 max-w-48 rounded border border-border object-contain"
          />
        ) : null}
        <input
          id={id}
          type="file"
          accept={
            favicon
              ? "image/png,image/x-icon,image/vnd.microsoft.icon"
              : "image/png,image/jpeg,image/webp"
          }
          aria-describedby={`${id}-hint`}
          onChange={(e) => void pick(e.target.files?.[0])}
          disabled={busy}
          className="text-sm"
        />
        {busy ? (
          <span className="text-sm text-muted">{t.fields.uploading}</span>
        ) : null}
        {path ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
            {t.fields.remove}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {t.fields.imageBad}
        </p>
      ) : null}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  contrastWith,
  t,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Show the contrast against this colour. */
  contrastWith?: string;
  t: T;
}) {
  const id = useId();
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  const ratio =
    valid && contrastWith ? contrastRatio(value, contrastWith) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded border border-border"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          maxLength={7}
          className="min-h-11 w-28 rounded-lg border border-border bg-surface px-3 font-mono text-sm"
        />
      </div>
      {ratio !== null ? (
        <p
          className={`text-xs ${ratio >= 4.5 ? "text-success" : "text-danger"}`}
        >
          {fill(t.fields.contrast, { ratio: ratio.toFixed(1) })} —{" "}
          {ratio >= 4.5 ? t.fields.contrastOk : t.fields.contrastLow}
        </p>
      ) : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--card-radius)] border border-border bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function BrandingEditor({
  initial,
  locale,
  dict,
}: {
  initial: SiteConfig;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.admin.branding;
  const router = useRouter();
  const [config, setConfig] = useState<SiteConfig>(initial);
  // A save refreshes the page, which remounts the editor (it's keyed on the
  // draft); carry the open tab and the confirmation over to the new instance.
  const [carried] = useState(() => carryOver);
  useEffect(() => {
    carryOver = null;
  }, []);
  const [tab, setTab] = useState<Tab>(carried?.tab ?? "identity");
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(carried ? { ok: true, text: carried.text } : null);

  const set = (fn: (c: SiteConfig) => void) =>
    setConfig((c) => {
      const next = structuredClone(c);
      fn(next);
      return next;
    });

  async function save() {
    setSaving(true);
    setFeedback(null);
    setIssues([]);
    try {
      const res = await saveBrandingDraftAction(config);
      if (res.ok) {
        setFeedback({ ok: true, text: t.actions.saved });
        carryOver = { tab, text: t.actions.saved };
        router.refresh();
      } else if ("issues" in res) setIssues(res.issues);
      else
        setFeedback({
          ok: false,
          text:
            res.error === "invalid_input"
              ? t.errors.invalid_image
              : (dict.admin.errors[res.error] ?? dict.admin.errors.failed),
        });
    } catch (err) {
      console.error(err);
      setFeedback({ ok: false, text: dict.admin.errors.failed });
    } finally {
      setSaving(false);
    }
  }

  const errorText = (m: string) =>
    (t.errors as Record<string, string>)[m] ?? t.errors.other;
  const theme = config.theme;
  const home = config.home;
  const footer = config.footer;
  const moveSection = (i: number, d: -1 | 1) =>
    set((c) => {
      const j = i + d;
      if (j < 0 || j >= c.home.sections.length) return;
      [c.home.sections[i], c.home.sections[j]] = [
        c.home.sections[j],
        c.home.sections[i],
      ];
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-[var(--card-radius)] border border-border bg-surface p-3 shadow-sm">
        <Button
          onClick={save}
          loading={saving}
          loadingLabel={dict.common.loading}
        >
          {t.actions.save}
        </Button>
        <Link
          href={`/${locale}/preview/branding`}
          target="_blank"
          rel="noopener"
          className={buttonClasses("secondary", "md")}
        >
          {t.actions.preview}
          <span className="sr-only"> {dict.common.opensNewTab}</span>
        </Link>
        <BrandingPublishControls t={dict.admin} />
        <p className="w-full text-xs text-muted">{t.actions.previewHint}</p>
      </div>
      {feedback ? (
        <Alert tone={feedback.ok ? "success" : "error"}>{feedback.text}</Alert>
      ) : null}
      {issues.length ? (
        <Alert tone="error" title={t.errors.title}>
          <ul className="list-disc ps-5">
            {issues.map((i, n) => (
              <li key={n}>
                <span className="font-mono text-xs">{i.path}</span>:{" "}
                {errorText(i.message)}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div
        role="tablist"
        aria-label={t.title}
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-t-lg px-4 text-sm font-medium ${tab === id ? "border-b-2 border-primary text-primary" : "text-muted hover:text-foreground"}`}
          >
            {t.tabs[id]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex flex-col gap-5"
      >
        {tab === "identity" ? (
          <>
            <Panel title={t.tabs.identity}>
              <TextPair
                label={t.fields.siteName}
                value={config.identity.siteName}
                max={60}
                t={t}
                onChange={(v) => set((c) => void (c.identity.siteName = v))}
              />
              <TextPair
                label={t.fields.tagline}
                value={config.identity.tagline}
                max={160}
                t={t}
                onChange={(v) => set((c) => void (c.identity.tagline = v))}
              />
              <ImageField
                label={t.fields.logo}
                hint={t.fields.logoHint}
                path={config.identity.logoPath}
                t={t}
                onChange={(p) => set((c) => void (c.identity.logoPath = p))}
              />
              <ImageField
                favicon
                label={t.fields.favicon}
                hint={t.fields.faviconHint}
                path={config.identity.faviconPath}
                t={t}
                onChange={(p) => set((c) => void (c.identity.faviconPath = p))}
              />
            </Panel>
            <p className="text-sm text-muted">{t.fields.notInStudio}</p>
          </>
        ) : null}

        {tab === "theme" ? (
          <>
            <Panel title={t.fields.colors}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ColorField
                  label={t.fields.primary}
                  value={theme.primary}
                  contrastWith="#ffffff"
                  t={t}
                  onChange={(v) => set((c) => void (c.theme.primary = v))}
                />
                <ColorField
                  label={t.fields.secondary}
                  value={theme.secondary}
                  t={t}
                  onChange={(v) => set((c) => void (c.theme.secondary = v))}
                />
                <ColorField
                  label={t.fields.accent}
                  value={theme.accent}
                  t={t}
                  onChange={(v) => set((c) => void (c.theme.accent = v))}
                />
                <ColorField
                  label={t.fields.background}
                  value={theme.background}
                  t={t}
                  onChange={(v) => set((c) => void (c.theme.background = v))}
                />
                <ColorField
                  label={t.fields.text}
                  value={theme.text}
                  contrastWith={theme.background}
                  t={t}
                  onChange={(v) => set((c) => void (c.theme.text = v))}
                />
              </div>
            </Panel>
            <Panel title={t.fields.typography}>
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectField
                  name="font"
                  label={t.fields.font}
                  value={theme.font}
                  onChange={(e) =>
                    set(
                      (c) =>
                        void (c.theme.font = e.target
                          .value as SiteConfig["theme"]["font"]),
                    )
                  }
                  options={FONT_CHOICES.map((f) => ({
                    value: f,
                    label: t.fields.fonts[f],
                  }))}
                />
                <SelectField
                  name="headingFont"
                  label={t.fields.headingFont}
                  value={theme.headingFont}
                  onChange={(e) =>
                    set(
                      (c) =>
                        void (c.theme.headingFont = e.target
                          .value as SiteConfig["theme"]["font"]),
                    )
                  }
                  options={FONT_CHOICES.map((f) => ({
                    value: f,
                    label: t.fields.fonts[f],
                  }))}
                />
                <SelectField
                  name="headingWeight"
                  label={t.fields.headingWeight}
                  value={theme.headingWeight}
                  onChange={(e) =>
                    set(
                      (c) =>
                        void (c.theme.headingWeight = e.target
                          .value as SiteConfig["theme"]["headingWeight"]),
                    )
                  }
                  options={HEADING_WEIGHTS.map((w) => ({
                    value: w,
                    label: t.fields.weights[w],
                  }))}
                />
              </div>
            </Panel>
            <Panel title={t.fields.components}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  name="buttonStyle"
                  label={t.fields.buttonStyle}
                  value={theme.buttonStyle}
                  onChange={(e) =>
                    set(
                      (c) =>
                        void (c.theme.buttonStyle = e.target
                          .value as SiteConfig["theme"]["buttonStyle"]),
                    )
                  }
                  options={BUTTON_STYLES.map((s) => ({
                    value: s,
                    label: t.fields.buttonStyles[s],
                  }))}
                />
                <SelectField
                  name="cardStyle"
                  label={t.fields.cardStyle}
                  value={theme.cardStyle}
                  onChange={(e) =>
                    set(
                      (c) =>
                        void (c.theme.cardStyle = e.target
                          .value as SiteConfig["theme"]["cardStyle"]),
                    )
                  }
                  options={CARD_STYLES.map((s) => ({
                    value: s,
                    label: t.fields.cardStyles[s],
                  }))}
                />
              </div>
              <div
                className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border p-4"
                style={{ background: theme.background, color: theme.text }}
              >
                <span className="text-sm">{t.fields.sample}</span>
                <span
                  className="inline-flex min-h-11 items-center px-4 font-medium text-white"
                  style={{
                    background: theme.primary,
                    borderRadius: {
                      square: "0.25rem",
                      rounded: "0.5rem",
                      pill: "9999px",
                    }[theme.buttonStyle],
                  }}
                >
                  {t.fields.sampleButton}
                </span>
                <span
                  className="inline-block h-14 w-24 border border-border"
                  style={{
                    background: theme.secondary,
                    borderRadius: {
                      flat: "0.375rem",
                      rounded: "0.75rem",
                      soft: "1.25rem",
                    }[theme.cardStyle],
                  }}
                />
              </div>
            </Panel>
          </>
        ) : null}

        {tab === "home" ? (
          <>
            <Panel title={t.fields.hero}>
              <p className="text-xs text-muted">{t.fields.blankDefault}</p>
              <TextPair
                label={t.fields.heroTitle}
                value={home.heroTitle}
                max={120}
                t={t}
                onChange={(v) => set((c) => void (c.home.heroTitle = v))}
              />
              <TextPair
                multiline
                label={t.fields.heroSubtitle}
                value={home.heroSubtitle}
                max={300}
                t={t}
                onChange={(v) => set((c) => void (c.home.heroSubtitle = v))}
              />
              <ImageField
                label={t.fields.heroImage}
                hint={t.fields.heroImageHint}
                path={home.heroImagePath}
                t={t}
                onChange={(p) => set((c) => void (c.home.heroImagePath = p))}
              />
              <TextPair
                label={`${t.fields.primaryCta} — ${t.fields.ctaLabel}`}
                value={home.primaryCta.label}
                max={40}
                t={t}
                onChange={(v) => set((c) => void (c.home.primaryCta.label = v))}
              />
              <TextField
                name="primaryHref"
                label={t.fields.ctaHref}
                value={home.primaryCta.href}
                onChange={(e) =>
                  set((c) => void (c.home.primaryCta.href = e.target.value))
                }
              />
              {home.secondaryCta ? (
                <>
                  <TextPair
                    label={`${t.fields.secondaryCta} — ${t.fields.ctaLabel}`}
                    value={home.secondaryCta.label}
                    max={40}
                    t={t}
                    onChange={(v) =>
                      set((c) => void (c.home.secondaryCta!.label = v))
                    }
                  />
                  <TextField
                    name="secondaryHref"
                    label={t.fields.ctaHref}
                    value={home.secondaryCta.href}
                    onChange={(e) =>
                      set(
                        (c) =>
                          void (c.home.secondaryCta!.href = e.target.value),
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start"
                    onClick={() => set((c) => void delete c.home.secondaryCta)}
                  >
                    {t.fields.remove}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  onClick={() =>
                    set(
                      (c) =>
                        void (c.home.secondaryCta = {
                          label: { en: "", dv: "" },
                          href: "/register",
                        }),
                    )
                  }
                >
                  {t.fields.secondaryCta}
                </Button>
              )}
            </Panel>
            <Panel title={t.fields.sections}>
              <p className="text-xs text-muted">{t.fields.sectionsHint}</p>
              <ol className="flex flex-col gap-2">
                {home.sections.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2"
                  >
                    <label className="flex flex-1 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={s.visible}
                        onChange={(e) =>
                          set(
                            (c) =>
                              void (c.home.sections[i].visible =
                                e.target.checked),
                          )
                        }
                        className="size-5 accent-primary"
                      />
                      {t.fields.sectionNames[s.id]}
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={i === 0}
                      onClick={() => moveSection(i, -1)}
                      aria-label={`${t.fields.moveUp}: ${t.fields.sectionNames[s.id]}`}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={i === home.sections.length - 1}
                      onClick={() => moveSection(i, 1)}
                      aria-label={`${t.fields.moveDown}: ${t.fields.sectionNames[s.id]}`}
                    >
                      ↓
                    </Button>
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel title={t.fields.featuredCategories}>
              <p className="text-xs text-muted">
                {t.fields.featuredCategoriesHint}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {PRODUCT_CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={home.featuredCategories.includes(cat)}
                      onChange={(e) =>
                        set((c) => {
                          c.home.featuredCategories = e.target.checked
                            ? [...c.home.featuredCategories, cat]
                            : c.home.featuredCategories.filter(
                                (x) => x !== cat,
                              );
                        })
                      }
                      className="size-5 accent-primary"
                    />
                    {dict.categories[cat]}
                  </label>
                ))}
              </div>
            </Panel>
            <Panel title={t.fields.promos}>
              {home.promos.map((p, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-lg border border-border p-3"
                >
                  <TextPair
                    label={t.fields.promoTitle}
                    value={p.title}
                    max={80}
                    t={t}
                    onChange={(v) =>
                      set((c) => void (c.home.promos[i].title = v))
                    }
                  />
                  <TextPair
                    multiline
                    label={t.fields.promoBody}
                    hint={t.fields.richHint}
                    value={p.body}
                    max={500}
                    t={t}
                    onChange={(v) =>
                      set((c) => void (c.home.promos[i].body = v))
                    }
                  />
                  <ImageField
                    label={t.fields.promoImage}
                    hint={t.fields.heroImageHint}
                    path={p.imagePath}
                    t={t}
                    onChange={(path) =>
                      set((c) => void (c.home.promos[i].imagePath = path))
                    }
                  />
                  {p.link ? (
                    <>
                      <TextPair
                        label={t.fields.linkLabel}
                        value={p.link.label}
                        max={40}
                        t={t}
                        onChange={(v) =>
                          set((c) => void (c.home.promos[i].link!.label = v))
                        }
                      />
                      <TextField
                        name={`promo-${i}-href`}
                        label={t.fields.linkHref}
                        value={p.link.href}
                        onChange={(e) =>
                          set(
                            (c) =>
                              void (c.home.promos[i].link!.href =
                                e.target.value),
                          )
                        }
                      />
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="self-start"
                      onClick={() =>
                        set(
                          (c) =>
                            void (c.home.promos[i].link = {
                              label: { en: "", dv: "" },
                              href: "/products",
                            }),
                        )
                      }
                    >
                      {t.fields.promoLink}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start text-danger"
                    onClick={() => set((c) => void c.home.promos.splice(i, 1))}
                  >
                    {t.fields.remove}
                  </Button>
                </div>
              ))}
              {home.promos.length < 3 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  onClick={() =>
                    set(
                      (c) =>
                        void c.home.promos.push({
                          title: { en: "", dv: "" },
                          body: { en: "", dv: "" },
                        }),
                    )
                  }
                >
                  {t.fields.addPromo}
                </Button>
              ) : null}
            </Panel>
          </>
        ) : null}

        {tab === "footer" ? (
          <>
            <Panel title={t.tabs.footer}>
              <TextPair
                multiline
                label={t.fields.footerAbout}
                hint={t.fields.richHint}
                value={footer.about}
                max={600}
                t={t}
                onChange={(v) => set((c) => void (c.footer.about = v))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  name="contactEmail"
                  type="email"
                  label={t.fields.contactEmail}
                  value={footer.contactEmail}
                  onChange={(e) =>
                    set(
                      (c) =>
                        void (c.footer.contactEmail = e.target.value.trim()),
                    )
                  }
                />
                <TextField
                  name="contactPhone"
                  label={t.fields.contactPhone}
                  value={footer.contactPhone}
                  onChange={(e) =>
                    set(
                      (c) =>
                        void (c.footer.contactPhone = e.target.value.trim()),
                    )
                  }
                />
              </div>
              <TextPair
                label={t.fields.address}
                value={footer.address}
                max={200}
                t={t}
                onChange={(v) => set((c) => void (c.footer.address = v))}
              />
            </Panel>
            <Panel title={t.fields.footerLinks}>
              {footer.links.map((l, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3"
                >
                  <TextPair
                    label={t.fields.linkLabel}
                    value={l.label}
                    max={40}
                    t={t}
                    onChange={(v) =>
                      set((c) => void (c.footer.links[i].label = v))
                    }
                  />
                  <TextField
                    name={`link-${i}`}
                    label={t.fields.linkHref}
                    value={l.href}
                    onChange={(e) =>
                      set((c) => void (c.footer.links[i].href = e.target.value))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start text-danger"
                    onClick={() => set((c) => void c.footer.links.splice(i, 1))}
                  >
                    {t.fields.remove}
                  </Button>
                </div>
              ))}
              {footer.links.length < 8 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  onClick={() =>
                    set(
                      (c) =>
                        void c.footer.links.push({
                          label: { en: "", dv: "" },
                          href: "https://",
                        }),
                    )
                  }
                >
                  {t.fields.addLink}
                </Button>
              ) : null}
            </Panel>
            <Panel title={t.fields.social}>
              {footer.social.map((s, i) => (
                <div
                  key={i}
                  className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
                >
                  <SelectField
                    name={`social-${i}-platform`}
                    id={`social-${i}-platform`}
                    label={t.fields.platform}
                    value={s.platform}
                    onChange={(e) =>
                      set(
                        (c) =>
                          void (c.footer.social[i].platform = e.target
                            .value as SocialPlatform),
                      )
                    }
                    options={(
                      Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]
                    ).map((p) => ({ value: p, label: dict.footer.social[p] }))}
                  />
                  <TextField
                    name={`social-${i}-url`}
                    id={`social-${i}-url`}
                    label={t.fields.url}
                    value={s.url}
                    onChange={(e) =>
                      set((c) => void (c.footer.social[i].url = e.target.value))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() =>
                      set((c) => void c.footer.social.splice(i, 1))
                    }
                  >
                    {t.fields.remove}
                  </Button>
                </div>
              ))}
              {footer.social.length < 7 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  onClick={() =>
                    set(
                      (c) =>
                        void c.footer.social.push({
                          platform: "facebook",
                          url: "https://www.facebook.com/",
                        }),
                    )
                  }
                >
                  {t.fields.addSocial}
                </Button>
              ) : null}
            </Panel>
          </>
        ) : null}

        {tab === "languages" ? (
          <>
            <Panel title={t.fields.languages}>
              <SelectField
                name="defaultLanguage"
                label={t.fields.defaultLanguage}
                value={config.languages.default}
                onChange={(e) =>
                  set(
                    (c) =>
                      void (c.languages.default = e.target.value as Locale),
                  )
                }
                options={LOCALES.map((l) => ({
                  value: l,
                  label: LOCALE_LABEL[l],
                }))}
              />
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">
                  {t.fields.enabledLanguages}
                </legend>
                {LOCALES.map((l) => (
                  <label key={l} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={config.languages.enabled.includes(l)}
                      onChange={(e) =>
                        set((c) => {
                          c.languages.enabled = e.target.checked
                            ? [...c.languages.enabled, l]
                            : c.languages.enabled.filter((x) => x !== l);
                        })
                      }
                      className="size-5 accent-primary"
                    />
                    {LOCALE_LABEL[l]}
                  </label>
                ))}
              </fieldset>
            </Panel>
            <Panel title={t.fields.seo}>
              <TextPair
                label={t.fields.seoTitle}
                hint={t.fields.blankDefault}
                value={config.seo.title}
                max={70}
                t={t}
                onChange={(v) => set((c) => void (c.seo.title = v))}
              />
              <TextPair
                multiline
                label={t.fields.seoDescription}
                hint={t.fields.blankDefault}
                value={config.seo.description}
                max={200}
                t={t}
                onChange={(v) => set((c) => void (c.seo.description = v))}
              />
              <ImageField
                label={t.fields.shareImage}
                hint={t.fields.shareImageHint}
                path={config.seo.shareImagePath}
                t={t}
                onChange={(p) => set((c) => void (c.seo.shareImagePath = p))}
              />
            </Panel>
          </>
        ) : null}
      </div>
    </div>
  );
}
