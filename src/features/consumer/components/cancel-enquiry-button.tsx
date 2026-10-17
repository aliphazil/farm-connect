"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setEnquiryStatus } from "@/services/client/interactions";
import { Button } from "@/components/ui/button";

/** Buyer cancels their own enquiry (rules allow new/accepted → cancelled only). */
export function CancelEnquiryButton({
  enquiryId,
  labels,
}: {
  enquiryId: string;
  labels: { cancel: string; confirm: string; failed: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function cancel() {
    if (!window.confirm(labels.confirm)) return;
    setPending(true);
    setError(false);
    try {
      await setEnquiryStatus(enquiryId, "cancelled");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        onClick={cancel}
        disabled={pending}
      >
        {labels.cancel}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {labels.failed}
        </p>
      ) : null}
    </div>
  );
}
