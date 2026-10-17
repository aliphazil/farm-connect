import Image from "next/image";
import type { ProductCategory } from "@shared/constants/catalog";
import { cn } from "@/lib/cn";
import { CATEGORY_ICON } from "@/features/catalog/categories";
import { isUnoptimizedImage } from "@/features/catalog/images";
import type { CatalogImage } from "@/features/catalog/types";

/**
 * Product photo that fills its (relatively positioned) parent. Falls back to
 * a calm category tile when a listing has no photo.
 */
export function ProductImage({
  image,
  alt,
  category,
  sizes,
  priority = false,
  className,
}: {
  image: CatalogImage | null;
  alt: string;
  category: ProductCategory;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-primary-soft",
          className,
        )}
      >
        <span aria-hidden="true" className="text-5xl">
          {CATEGORY_ICON[category]}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={image.src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={isUnoptimizedImage(image.src)}
      className={cn("object-cover", className)}
    />
  );
}
