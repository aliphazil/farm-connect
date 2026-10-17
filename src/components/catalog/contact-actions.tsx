"use client";

import type { Locale } from "@shared/constants/locales";
import type { ContactChannel } from "@shared/schemas";
import { whatsappLink } from "@shared/utils/phone";
import type { FarmerContactView } from "@/features/catalog/types";
import { logSiteEvent } from "@/services/client/interactions";
import { buttonClasses } from "@/components/ui/button";
import { ChatIcon, PhoneIcon } from "@/components/ui/icons";

export type ContactLabels = {
  call: string;
  whatsapp: string;
  viber: string;
  opensNewTab: string;
  hidden: string;
};

/** Repeat clicks on the same button within this window count once. */
const CLICK_DEDUPE_MS = 30 * 60 * 1000;

/** True the first time in the window; remembers the click in sessionStorage. */
function firstClick(key: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(key));
    if (last && Date.now() - last < CLICK_DEDUPE_MS) return false;
    sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage unavailable: count the click.
  }
  return true;
}

/**
 * Direct buyer→farmer contact. Renders real tel:/WhatsApp/Viber links only
 * when contact details are provided; otherwise explains why they're hidden.
 * Clicks are counted for the farmer's dashboard when `track` is given — a
 * click means the buyer opened their phone or chat app, not that a message
 * was delivered or a sale happened.
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
  track?: { locale: Locale; farmerId: string; productId?: string };
}) {
  if (!contact) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-background p-3 text-sm text-muted">
        {labels.hidden}
      </p>
    );
  }

  const onClick = (channel: ContactChannel) => () => {
    if (!track) return;
    const key = `fc:click:${channel}:${track.productId ?? track.farmerId}`;
    if (!firstClick(key)) return;
    logSiteEvent({
      type: "contact_click",
      ...track,
      channel,
      path: window.location.pathname,
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
