"use client";

import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import {
  liftExpiredSuspensionsAction,
  setAppealSettingsAction,
  setModerationSettingsAction,
} from "../actions";
import { ConfirmAction } from "./confirm-action";

/** Turns listing pre-approval on or off. */
export function ApprovalToggle({
  enabled,
  t,
}: {
  enabled: boolean;
  t: Dictionary["admin"];
}) {
  const s = t.settings;
  return (
    <ConfirmAction
      t={t}
      tone={enabled ? "secondary" : "primary"}
      label={enabled ? s.turnOff : s.turnOn}
      title={s.approval}
      body={enabled ? s.approvalConfirmOff : s.approvalConfirmOn}
      onConfirm={() => setModerationSettingsAction(!enabled)}
      success={s.saved}
    />
  );
}

/** Lifts suspensions whose end has passed (they also lift at the next sign-in). */
export function LiftSuspensions({ t }: { t: Dictionary["admin"] }) {
  const d = t.dashboard;
  return (
    <ConfirmAction
      t={t}
      tone="secondary"
      label={d.liftNow}
      title={d.liftNow}
      onConfirm={() => liftExpiredSuspensionsAction()}
      success={(r) => fill(d.lifted, { count: r.ok ? (r.count ?? 0) : 0 })}
    />
  );
}

/** Opens/closes appeals, or allows/disallows pausing appeals during investigations. */
export function AppealSettingToggle({
  setting,
  enabled,
  t,
}: {
  setting: "appealsEnabled" | "allowAppealHold";
  enabled: boolean;
  t: Dictionary["admin"];
}) {
  const s = t.settings;
  const body =
    setting === "appealsEnabled"
      ? enabled
        ? s.appealsConfirmOff
        : s.appealsConfirmOn
      : enabled
        ? s.holdConfirmOff
        : s.holdConfirmOn;
  return (
    <ConfirmAction
      t={t}
      tone={enabled ? "secondary" : "primary"}
      label={enabled ? s.turnOff : s.turnOn}
      title={setting === "appealsEnabled" ? s.appeals : s.hold}
      body={body}
      onConfirm={() => setAppealSettingsAction({ [setting]: !enabled })}
      success={s.saved}
    />
  );
}
