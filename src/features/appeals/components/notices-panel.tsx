"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import type { NoticeData } from "../client";
import { NoticeList } from "./notice-list";

/** Account notices for a signed-in user (data loaded on the server). */
export function NoticesPanel(props: {
  notices: NoticeData[];
  appealsEnabled: boolean;
  dict: Dictionary;
  locale: Locale;
}) {
  const router = useRouter();
  return <NoticeList {...props} onChanged={() => router.refresh()} />;
}
