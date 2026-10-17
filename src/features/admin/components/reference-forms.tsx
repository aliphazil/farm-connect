"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { ATOLLS } from "@shared/constants/geography";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { islandIdFor } from "@shared/island-id";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import {
  createIslandAction,
  deleteIslandAction,
  updateIslandAction,
  updateReferenceItemAction,
  type AdminActionResult,
} from "../actions";
import { ConfirmAction, resultMessage, type Feedback } from "./confirm-action";

type AdminText = Dictionary["admin"];

function useSubmit(t: AdminText) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  async function run(work: () => Promise<AdminActionResult>, success: string) {
    setPending(true);
    setFeedback(null);
    try {
      const result = await work();
      setFeedback(resultMessage(result, success, t));
      if (result.ok) router.refresh();
      return result.ok;
    } catch (err) {
      console.error(err);
      setFeedback({ tone: "error", text: t.errors.failed });
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, feedback, run };
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return feedback ? (
    <Alert tone={feedback.tone === "success" ? "success" : "error"}>
      {feedback.text}
    </Alert>
  ) : null;
}

/** Labels and availability of one category or unit. */
export function ReferenceItemForm({
  kind,
  id,
  label,
  defaultLabel,
  active,
  t,
}: {
  kind: "category" | "unit";
  id: string;
  label: { en: string; dv: string };
  defaultLabel: { en: string; dv: string };
  active: boolean;
  t: AdminText;
}) {
  const r = t.reference;
  const uid = useId();
  const { pending, feedback, run } = useSubmit(t);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () =>
        updateReferenceItemAction(kind, id, {
          labelEn: String(form.get("labelEn") ?? "").trim(),
          labelDv: String(form.get("labelDv") ?? "").trim(),
          active: form.get("active") === "on",
        }),
      r.saved,
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
      aria-label={label.en}
    >
      <p className="font-mono text-xs text-muted">{id}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id={`${uid}-en`}
          name="labelEn"
          label={r.labelEn}
          defaultValue={label.en}
          hint={fill(r.defaultLabel, { label: defaultLabel.en })}
          maxLength={60}
        />
        <TextField
          id={`${uid}-dv`}
          name="labelDv"
          label={r.labelDv}
          defaultValue={label.dv}
          hint={fill(r.defaultLabel, { label: defaultLabel.dv })}
          maxLength={60}
          dir="rtl"
        />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={active}
          className="size-5 accent-primary"
        />
        {r.available}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          loading={pending}
          loadingLabel={t.common.working}
        >
          {r.save}
        </Button>
        <FeedbackLine feedback={feedback} />
      </div>
    </form>
  );
}

/** Adds an island; shows the id it will get (it never changes afterwards). */
export function IslandCreateForm({ t }: { t: AdminText }) {
  const r = t.reference;
  const { pending, feedback, run } = useSubmit(t);
  const [atoll, setAtoll] = useState("");
  const [nameEn, setNameEn] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const ok = await run(
      () =>
        createIslandAction({
          atollCode: String(form.get("atollCode")) as never,
          nameEn: String(form.get("nameEn") ?? "").trim(),
          nameDv: String(form.get("nameDv") ?? "").trim(),
          active: form.get("active") === "on",
        }),
      r.created,
    );
    if (ok) {
      formEl.reset();
      setAtoll("");
      setNameEn("");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <h3 className="font-semibold">{r.addIsland}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          id="new-island-atoll"
          name="atollCode"
          label={r.atoll}
          placeholder={r.chooseAtoll}
          required
          value={atoll}
          onChange={(e) => setAtoll(e.target.value)}
          options={ATOLLS.map((a) => ({
            value: a.code,
            label: `${a.abbr} — ${a.nameEn}`,
          }))}
        />
        <TextField
          id="new-island-en"
          name="nameEn"
          label={r.nameEn}
          required
          minLength={2}
          maxLength={60}
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          hint={
            atoll && nameEn.trim().length > 1
              ? fill(r.idPreview, { id: islandIdFor(atoll, nameEn) })
              : undefined
          }
        />
        <TextField
          id="new-island-dv"
          name="nameDv"
          label={r.nameDv}
          maxLength={60}
          dir="rtl"
        />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked
          className="size-5 accent-primary"
        />
        {r.selectable}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} loadingLabel={t.common.working}>
          {r.add}
        </Button>
        <FeedbackLine feedback={feedback} />
      </div>
    </form>
  );
}

/** Edit one island's names/availability (the id never changes). */
export function IslandEditForm({
  island,
  t,
}: {
  island: {
    id: string;
    atollCode: string;
    nameEn: string;
    nameDv?: string;
    active: boolean;
  };
  t: AdminText;
}) {
  const r = t.reference;
  const uid = useId();
  const { pending, feedback, run } = useSubmit(t);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(
      () =>
        updateIslandAction(island.id, {
          atollCode: String(form.get("atollCode")) as never,
          nameEn: String(form.get("nameEn") ?? "").trim(),
          nameDv: String(form.get("nameDv") ?? "").trim(),
          active: form.get("active") === "on",
        }),
      r.updated,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField
            id={`${uid}-atoll`}
            name="atollCode"
            label={r.atoll}
            defaultValue={island.atollCode}
            options={ATOLLS.map((a) => ({
              value: a.code,
              label: `${a.abbr} — ${a.nameEn}`,
            }))}
          />
          <TextField
            id={`${uid}-en`}
            name="nameEn"
            label={r.nameEn}
            defaultValue={island.nameEn}
            required
            maxLength={60}
          />
          <TextField
            id={`${uid}-dv`}
            name="nameDv"
            label={r.nameDv}
            defaultValue={island.nameDv}
            maxLength={60}
            dir="rtl"
          />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={island.active}
            className="size-5 accent-primary"
          />
          {r.selectable}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="sm"
            loading={pending}
            loadingLabel={t.common.working}
          >
            {r.save}
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
      <ConfirmAction
        t={t}
        tone="danger"
        label={r.delete}
        title={r.delete}
        body={r.deleteConfirm}
        onConfirm={() => deleteIslandAction(island.id)}
        success={r.deleted}
      />
    </div>
  );
}
