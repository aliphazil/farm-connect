import "server-only";

import Link from "next/link";
import { COLLECTIONS, favouriteId } from "@shared/firestore-paths";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import {
  consumerProfileSchema,
  userSchema,
  type FavouriteTarget,
} from "@shared/schemas";
import { localeHref } from "@/i18n/paths";
import { getSessionUser } from "@/lib/auth/session";
import { col, getModel } from "@/services/server/db";
import { buttonClasses } from "@/components/ui/button";
import { EnquiryForm } from "./components/enquiry-form";
import { FavouriteButton } from "./components/favourite-button";
import { ReportForm } from "./components/report-form";

/**
 * Viewer-dependent actions (save, enquire, report). Reads the session, so it
 * must be rendered inside <Suspense>; the rest of the page stays cacheable.
 * Guests see sign-in links that bring them back here afterwards.
 */

function loginHref(locale: Locale, returnTo: string) {
  return `${localeHref(locale, "/login")}?next=${encodeURIComponent(returnTo)}`;
}

async function isSaved(
  uid: string,
  targetType: FavouriteTarget,
  targetId: string,
) {
  return (
    await col(COLLECTIONS.favourites)
      .doc(favouriteId(uid, targetType, targetId))
      .get()
  ).exists;
}

function SignInLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={buttonClasses("secondary", "sm")}>
      {label}
    </Link>
  );
}

export async function ProductBuyerActions({
  product,
  locale,
  dict,
}: {
  product: {
    id: string;
    farmerId: string;
    unitLabel: string;
    minOrder?: number;
    soldOut: boolean;
  };
  locale: Locale;
  dict: Dictionary;
}) {
  const returnTo = localeHref(locale, `/products/${product.id}`);
  const user = await getSessionUser();

  if (!user) {
    const login = loginHref(locale, returnTo);
    return (
      <div className="flex flex-wrap gap-2">
        <SignInLink href={login} label={dict.products.signInToSave} />
        {product.soldOut ? null : (
          <SignInLink href={login} label={dict.enquiry.signIn} />
        )}
        <SignInLink href={login} label={dict.report.signIn} />
      </div>
    );
  }

  if (user.uid === product.farmerId) {
    return <p className="text-sm text-muted">{dict.enquiry.ownProduct}</p>;
  }

  const [saved, account, consumer] = await Promise.all([
    isSaved(user.uid, "product", product.id),
    getModel(COLLECTIONS.users, user.uid, userSchema, "uid"),
    getModel(
      COLLECTIONS.consumerProfiles,
      user.uid,
      consumerProfileSchema,
      "uid",
    ),
  ]);
  const deliverTo = consumer?.defaultDeliveryLocation ?? account?.location;
  const restricted = new Set(account?.restrictions ?? []);

  return (
    <div className="flex flex-col gap-5">
      <FavouriteButton
        targetType="product"
        targetId={product.id}
        initialSaved={saved}
        labels={{
          save: dict.products.save,
          saved: dict.products.saved,
          unsave: dict.products.unsave,
          failed: dict.products.saveFailed,
        }}
      />
      <div>
        <h2 className="mb-2 font-semibold">{dict.enquiry.title}</h2>
        {restricted.has("enquiries") ? (
          <p className="text-sm text-muted">
            {dict.restrictionNotices.enquiries}
          </p>
        ) : product.soldOut ? (
          <p className="text-sm text-muted">{dict.enquiry.notAvailable}</p>
        ) : (
          <EnquiryForm
            productId={product.id}
            unitLabel={product.unitLabel}
            minOrder={product.minOrder}
            defaults={{
              name: account?.displayName,
              phone: account?.phone,
              atollCode: deliverTo?.atollCode,
              islandId: deliverTo?.islandId,
            }}
            dict={dict}
            locale={locale}
          />
        )}
      </div>
      {restricted.has("reports") ? null : (
        <ReportForm
          targetType="product"
          targetId={product.id}
          dict={dict}
          locale={locale}
        />
      )}
    </div>
  );
}

export async function FarmerBuyerActions({
  farmerId,
  locale,
  dict,
}: {
  farmerId: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const user = await getSessionUser();
  if (!user) {
    const login = loginHref(locale, localeHref(locale, `/farmers/${farmerId}`));
    return (
      <div className="flex flex-wrap gap-2">
        <SignInLink href={login} label={dict.products.signInToSave} />
        <SignInLink href={login} label={dict.report.signIn} />
      </div>
    );
  }
  if (user.uid === farmerId) return null;
  const [saved, account] = await Promise.all([
    isSaved(user.uid, "farmer", farmerId),
    getModel(COLLECTIONS.users, user.uid, userSchema, "uid"),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <FavouriteButton
        targetType="farmer"
        targetId={farmerId}
        initialSaved={saved}
        labels={{
          save: dict.products.saveFarm,
          saved: dict.products.savedFarm,
          unsave: dict.products.unsave,
          failed: dict.products.saveFailed,
        }}
      />
      {account?.restrictions?.includes("reports") ? null : (
        <ReportForm
          targetType="farmer"
          targetId={farmerId}
          dict={dict}
          locale={locale}
        />
      )}
    </div>
  );
}
