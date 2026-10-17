"use client";

import {
  ACCOUNT_RESTRICTIONS,
  SUSPENSION_DAYS,
  type AccountRestriction,
  type AdminPermission,
} from "@shared/constants/admin";
import type { AccountStatus, Role } from "@shared/constants/roles";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import type { FarmerApprovalStatus } from "@shared/schemas";
import { SelectField } from "@/components/ui/form-field";
import {
  blockUserAction,
  changeRoleAction,
  restoreUserAction,
  setFarmerApprovalAction,
  setRestrictionsAction,
  suspendUserAction,
} from "../actions";
import { ActionPanel, ConfirmAction } from "./confirm-action";

const reasonOf = (form: FormData) => String(form.get("reason") ?? "").trim();

/**
 * Account actions an admin may take, shown according to their permissions
 * (each action is re-checked on the server).
 */
export function UserActions({
  uid,
  role,
  status,
  approval,
  restrictions,
  permissions,
  t,
}: {
  uid: string;
  role: Role;
  status: AccountStatus;
  approval?: FarmerApprovalStatus;
  restrictions: string[];
  permissions: readonly AdminPermission[];
  t: Dictionary["admin"];
}) {
  const can = (p: AdminPermission) => permissions.includes(p);
  const a = t.userActions;
  const days = (n: number) =>
    n === 1 ? a.dayOne : fill(a.dayMany, { count: n });

  return (
    <ActionPanel>
      {role === "farmer" && can("farmers.approve") ? (
        <div className="flex flex-wrap gap-3">
          {approval !== "approved" ? (
            <ConfirmAction
              t={t}
              label={a.approve}
              title={a.approve}
              body={a.approveConfirm}
              reason="optional"
              onConfirm={(f) =>
                setFarmerApprovalAction(
                  uid,
                  "approved",
                  reasonOf(f) || undefined,
                )
              }
              success={a.done.approved}
            />
          ) : null}
          {approval !== "rejected" ? (
            <ConfirmAction
              t={t}
              tone="danger"
              label={a.reject}
              title={a.reject}
              body={a.rejectConfirm}
              reason="required"
              onConfirm={(f) =>
                setFarmerApprovalAction(uid, "rejected", reasonOf(f))
              }
              success={a.done.rejected}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {status === "active" && can("users.moderate") ? (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={a.suspend}
            title={a.suspend}
            body={a.suspendConfirm}
            reason="required"
            fields={
              <SelectField
                id={`suspend-days-${uid}`}
                name="days"
                label={a.days}
                defaultValue="7"
                options={SUSPENSION_DAYS.map((n) => ({
                  value: String(n),
                  label: days(n),
                }))}
              />
            }
            onConfirm={(f) =>
              suspendUserAction(uid, Number(f.get("days")), reasonOf(f))
            }
            success={a.done.suspended}
          />
        ) : null}
        {status !== "blocked" && can("users.block") ? (
          <ConfirmAction
            t={t}
            tone="danger"
            label={a.block}
            title={a.block}
            body={a.blockConfirm}
            reason="required"
            onConfirm={(f) => blockUserAction(uid, reasonOf(f))}
            success={a.done.blocked}
          />
        ) : null}
        {(status === "suspended" && can("users.moderate")) ||
        (status === "blocked" && can("users.block")) ? (
          <ConfirmAction
            t={t}
            label={a.restore}
            title={a.restore}
            body={a.restoreConfirm}
            reason="optional"
            onConfirm={(f) => restoreUserAction(uid, reasonOf(f) || undefined)}
            success={a.done.restored}
          />
        ) : null}
      </div>

      {can("users.moderate") ? (
        <ConfirmAction
          t={t}
          tone="secondary"
          label={a.restrict}
          title={a.restrict}
          body={a.restrictHelp}
          confirmLabel={a.restrictConfirm}
          reason="required"
          fields={
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{t.userDetail.restrictions}</legend>
              {ACCOUNT_RESTRICTIONS.map((r) => (
                <label key={r} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="restrictions"
                    value={r}
                    defaultChecked={restrictions.includes(r)}
                    className="size-5 accent-primary"
                  />
                  {t.userDetail.restrictionLabels[r]}
                </label>
              ))}
            </fieldset>
          }
          onConfirm={(f) =>
            setRestrictionsAction(
              uid,
              f.getAll("restrictions").map(String) as AccountRestriction[],
              reasonOf(f),
            )
          }
          success={a.done.restricted}
        />
      ) : null}

      {can("users.role") && (role === "farmer" || role === "consumer") ? (
        <ConfirmAction
          t={t}
          tone="secondary"
          label={role === "farmer" ? a.toBuyer : a.toFarmer}
          title={a.changeRole}
          body={fill(a.roleConfirm, {
            role: t.userDetail.roles[role === "farmer" ? "consumer" : "farmer"],
          })}
          onConfirm={() =>
            changeRoleAction(uid, role === "farmer" ? "consumer" : "farmer")
          }
          success={a.done.roleChanged}
        />
      ) : null}
    </ActionPanel>
  );
}
