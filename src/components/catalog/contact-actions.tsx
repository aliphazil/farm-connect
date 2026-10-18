"use client";

import type { ContactChannel } from "@shared/schemas";
import { whatsappLink } from "@shared/utils/phone";
import type { FarmerContactView } from "@/features/catalog/types";
import { trackNow } from "@/services/client/analytics";
import { buttonClasses } from "@/components/ui/button";
import { ChatIcon, PhoneIcon } from "@/components/ui/icons";

export type ContactLabels = {
  call: string;
  whatsapp: string;
  viber: string;
  opensNewTab: string;
  hidden: string;
};

/**
 * Direct buyer→farmer contact. Renders real tel:/WhatsApp/Viber links only
 * when contact details are provided; otherwise explains why they're hidden.
 * Clicks are counted for analytics when `track` is given — a click means the
 * buyer's phone or chat app was opened, not that a message was delivered or
 * a sale happened.
 */
export function ContactActions({
  contact,
  labels,
  message,
  track,
}: {
  contact: FarmerContactView | null;
  labels: ContactLabels;
  /** Prefilled WhatsApp message. */
  message?: string;
  track?: { farmerId: string; productId?: string };
}) {
  if (!contact) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-background p-3 text-sm text-muted">
        {labels.hidden}
      </p>
    );
  }

  // The server counts each visitor once per button and listing per day.
  const onClick = (channel: ContactChannel) => () => {
    if (!track) return;
    trackNow({
      type: "contact_click",
      channel,
      ...(track.productId
        ? { productId: track.productId }
        : { farmerId: track.farmerId }),
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <a
        href={`tel:${contact.phone}`}
        onClick={onClick("call")}
        className={buttonClasses("primary", "md")}
      >
        <PhoneIcon />
        {labels.call}
      </a>
      {contact.whatsapp ? (
        <a
          href={whatsappLink(contact.whatsapp, message)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick("whatsapp")}
          className={buttonClasses("secondary", "md")}
        >
          <ChatIcon />
          {labels.whatsapp}
          <span className="sr-only">{labels.opensNewTab}</span>
        </a>
      ) : null}
      {contact.viber ? (
        <a
          href={`viber://chat?number=${encodeURIComponent(contact.viber)}`}
          onClick={onClick("viber")}
          className={buttonClasses("secondary", "md")}
        >
          <ChatIcon />
          {labels.viber}
        </a>
      ) : null}
    </div>
  );
}
