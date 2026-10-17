"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_LISTING_IMAGES } from "@shared/constants/catalog";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { storageObjectUrl } from "@/features/catalog/images";
import { checkImage } from "@/services/client/uploads";
import { buttonClasses } from "@/components/ui/button";

export type ImageItem =
  | { kind: "stored"; path: string }
  | { kind: "new"; id: string; file: File; previewUrl: string };

/**
 * Photo picker for a product: shows stored and newly chosen photos, validates
 * type/size before upload, lets the farmer remove photos or pick the cover.
 * Uploading happens when the form is saved.
 */
export function ImageManager({
  items,
  onChange,
  dict,
}: {
  items: ImageItem[];
  onChange: (items: ImageItem[]) => void;
  dict: Dictionary;
}) {
  const t = dict.farmerPortal.form;
  const input = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);

  // Free preview URLs when the component goes away.
  const latest = useRef(items);
  useEffect(() => {
    latest.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const item of latest.current)
        if (item.kind === "new") URL.revokeObjectURL(item.previewUrl);
    },
    [],
  );

  function addFiles(files: FileList | null) {
    if (!files) return;
    const issues: string[] = [];
    const next = [...items];
    for (const file of Array.from(files)) {
      const problem = checkImage(file);
      if (problem === "type")
        issues.push(fill(t.imageWrongType, { name: file.name }));
      else if (problem === "size")
        issues.push(fill(t.imageTooLarge, { name: file.name }));
      else if (next.length >= MAX_LISTING_IMAGES) {
        if (!issues.includes(t.tooManyImages)) issues.push(t.tooManyImages);
      } else {
        next.push({
          kind: "new",
          id: `${file.name}-${file.size}-${next.length}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    }
    setProblems(issues);
    onChange(next);
    if (input.current) input.current.value = "";
  }

  function remove(index: number) {
    const item = items[index];
    if (item.kind === "new") URL.revokeObjectURL(item.previewUrl);
    onChange(items.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    onChange([item, ...next]);
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">{t.images}</legend>
      <p id="images-hint" className="mt-1 text-sm text-muted">
        {t.imagesHint}
      </p>
      {problems.length > 0 ? (
        <ul role="alert" className="mt-2 list-disc ps-5 text-sm text-danger">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((item, i) => {
          const src =
            item.kind === "stored"
              ? storageObjectUrl(item.path)
              : item.previewUrl;
          return (
            <li
              key={item.kind === "stored" ? item.path : item.id}
              className="relative overflow-hidden rounded-lg border border-border bg-primary-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local previews and Storage URLs */}
              <img
                src={src}
                alt=""
                className="aspect-square w-full object-cover"
              />
              {i === 0 ? (
                <span className="absolute start-1 top-1 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-white">
                  {t.cover}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makeCover(i)}
                  className="absolute start-1 top-1 rounded bg-surface/90 px-1.5 py-0.5 text-xs font-medium"
                >
                  {t.cover}
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={fill(t.removePhoto, { n: i + 1 })}
                className="absolute end-1 top-1 flex size-8 items-center justify-center rounded-full bg-surface/90 text-lg leading-none text-danger"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {items.length < MAX_LISTING_IMAGES ? (
        <label
          className={`${buttonClasses("secondary", "md")} mt-3 cursor-pointer`}
        >
          {t.addPhotos}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-describedby="images-hint"
            className="sr-only"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
      ) : null}
    </fieldset>
  );
}
