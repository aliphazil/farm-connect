"use client";

import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import type { EnquiryStatus } from "@shared/schemas";
import { whatsappLink } from "@shared/utils/phone";
import { setEnquiryStatus } from "@/services/client/interactions";
import { Button, buttonClasses } from "@/components/ui/button";
import { ChatIcon, PhoneIcon } from "@/components/ui/icons";
import { useFarmerAction } from "./use-farmer-action";

/**
 * Status changes the farmer is allowed to make (mirrors the rules), plus
 * contact links that only use the phone number the buyer chose to share.
 */
export function EnquiryActions({
  enquiryId,
  status,
  consumerPhone,
  farmName,
  productTitle,
  dict,
}: {
  enquiryId: string;
  status: EnquiryStatus;
  consumerPhone?: string;
  farmName: string;
  productTitle: string;
  dict: Dictionary;
}) {
  const t = dict.farmerPortal.enquiries;
  const { run, pending, error } = useFarmerAction(
    dict.authErrors.sessionExpired,
  );
  const set = (next: EnquiryStatus) =>
    run(() => setEnquiryStatus(enquiryId, next), t.updateFailed);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "new" ? (
          <>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => set("accepted")}
            >
              {t.accept}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => set("declined")}
            >
              {t.decline}
            </Button>
          </>
        ) : null}
        {status === "accepted" ? (
          <Button size="sm" disabled={pending} onClick={() => set("completed")}>
            {t.complete}
          </Button>
        ) : null}
        {consumerPhone ? (
          <>
            <a
              href={`tel:${consumerPhone}`}
              className={buttonClasses("secondary", "sm")}
            >
              <PhoneIcon />
              {t.call}
            </a>
            <a
              href={whatsappLink(
                consumerPhone,
                fill(t.whatsappMessage, {
                  farm: farmName,
                  product: productTitle,
                }),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("secondary", "sm")}
            >
              <ChatIcon />
              {t.whatsapp}
              <span className="sr-only">{dict.common.opensNewTab}</span>
            </a>
          </>
        ) : (
          <p className="self-center text-sm text-muted">{t.noContact}</p>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
