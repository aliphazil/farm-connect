"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FavouriteTarget } from "@shared/schemas";
import { addFavourite, removeFavourite } from "@/services/client/interactions";
import { Button } from "@/components/ui/button";

/** Save / unsave a product or farm (signed-in users; rules keep it private). */
export function FavouriteButton({
  targetType,
  targetId,
  initialSaved,
  labels,
}: {
  targetType: FavouriteTarget;
  targetId: string;
  initialSaved: boolean;
  labels: { save: string; saved: string; unsave: string; failed: string };
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setPending(true);
    setError(false);
    try {
      if (saved) await removeFavourite(targetType, targetId);
      else await addFavourite(targetType, targetId);
      setSaved(!saved);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={saved ? "secondary" : "primary"}
        size="sm"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        title={saved ? labels.unsave : undefined}
      >
        <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
        {saved ? labels.saved : labels.save}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {labels.failed}
        </p>
      ) : null}
    </div>
  );
}
