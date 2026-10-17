import type { Dictionary } from "@shared/i18n";
import type { FarmerProfile } from "@shared/schemas";
import { Alert } from "@/components/ui/alert";
import { VerifiedIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/layout-primitives";

/** Approval + verification status, with a clear message for each state. */
export function FarmStatus({
  farm,
  dict,
}: {
  farm: FarmerProfile;
  dict: Dictionary;
}) {
  const t = dict.farmerPortal.profile;
  return (
    <div className="flex flex-col gap-3">
      {farm.approvalStatus === "pending" ? (
        <Alert tone="warning">{dict.auth.farmerPending}</Alert>
      ) : null}
      {farm.approvalStatus === "rejected" ? (
        <Alert tone="error">{dict.auth.farmerRejected}</Alert>
      ) : null}
      {farm.approvalStatus === "approved" && farm.visible ? (
        <Alert tone="success">
          {dict.farmerPortal.dashboard.statusApproved}
        </Alert>
      ) : null}
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{t.verification}:</span>
        <Badge
          tone={
            farm.approvalStatus === "approved"
              ? "success"
              : farm.approvalStatus === "rejected"
                ? "danger"
                : "warning"
          }
        >
          {t[farm.approvalStatus]}
        </Badge>
        {farm.verified ? (
          <Badge tone="success" className="gap-1">
            <VerifiedIcon className="size-3.5" />
            {t.verified}
          </Badge>
        ) : (
          <Badge>{t.notVerified}</Badge>
        )}
      </p>
    </div>
  );
}
