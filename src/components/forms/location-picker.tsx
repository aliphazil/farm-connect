"use client";

import { useEffect, useState } from "react";
import { islandName } from "@shared/constants/geography";
import type { Locale } from "@shared/constants/locales";
import { SelectField } from "@/components/ui/form-field";
import { Spinner } from "@/components/ui/spinner";
import { loadGeography, type Geography } from "@/services/client/geography";

export type LocationLabels = {
  atoll: string;
  island: string;
  chooseAtoll: string;
  chooseIsland: string;
  wholeAtoll?: string;
  loading: string;
  unavailable: string;
  required: string;
};

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; geo: Geography };

/** Loads atoll/island records once and shares them between pickers. */
export function useGeography(): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    loadGeography()
      .then(
        (geo) =>
          alive &&
          setState(
            geo.atolls.length ? { status: "ready", geo } : { status: "error" },
          ),
      )
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/**
 * Atoll + island selects backed by the normalised Firestore records — never a
 * hardcoded island list. With `allowWholeAtoll`, the island is optional and
 * "whole atoll" is offered. Field names: `${name}Atoll`, `${name}Island`.
 */
export function LocationPicker({
  name,
  locale,
  labels,
  required = false,
  allowWholeAtoll = false,
  defaultAtoll = "",
  defaultIsland = "",
  error,
  onChange,
}: {
  name: string;
  locale: Locale;
  labels: LocationLabels;
  required?: boolean;
  allowWholeAtoll?: boolean;
  defaultAtoll?: string;
  defaultIsland?: string;
  error?: string;
  onChange?: (value: { atollCode: string; islandId: string }) => void;
}) {
  const state = useGeography();
  const [atoll, setAtoll] = useState(defaultAtoll);
  const [island, setIsland] = useState(defaultIsland);

  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner label={labels.loading} />
        <span aria-hidden="true">{labels.loading}</span>
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p
        role="alert"
        className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
      >
        {labels.unavailable}
      </p>
    );
  }

  const { atolls, islands } = state.geo;
  const islandOptions = islands.filter((i) => i.atollCode === atoll);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        id={`${name}-atoll`}
        name={`${name}Atoll`}
        label={labels.atoll}
        value={atoll}
        onChange={(e) => {
          setAtoll(e.target.value);
          setIsland("");
          onChange?.({ atollCode: e.target.value, islandId: "" });
        }}
        placeholder={labels.chooseAtoll}
        required={required}
        requiredLabel={labels.required}
        error={error}
        options={atolls.map((a) => ({
          value: a.code,
          label: locale === "dv" ? a.nameDv : a.nameEn,
        }))}
      />
      <SelectField
        id={`${name}-island`}
        name={`${name}Island`}
        label={labels.island}
        value={island}
        onChange={(e) => {
          setIsland(e.target.value);
          onChange?.({ atollCode: atoll, islandId: e.target.value });
        }}
        placeholder={
          allowWholeAtoll
            ? (labels.wholeAtoll ?? labels.chooseIsland)
            : labels.chooseIsland
        }
        disabled={!atoll}
        required={required && !allowWholeAtoll}
        requiredLabel={labels.required}
        options={islandOptions.map((i) => ({
          value: i.id,
          label: islandName(i, locale),
        }))}
      />
    </div>
  );
}
