import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Accessible form controls. Each control is linked to its label, hint and
 * error via htmlFor / aria-describedby, and marks itself aria-invalid on error.
 * The control's id defaults to its `name`.
 */
type FieldChrome = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Text shown next to required labels, e.g. dict.common.required. */
  requiredLabel?: string;
};

const controlClasses =
  "block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-foreground " +
  "placeholder:text-muted/70 focus:border-primary aria-invalid:border-danger disabled:opacity-60";

function fieldIds(id: string, hint?: ReactNode, error?: ReactNode) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return { hintId, errorId, describedBy };
}

function Field({
  id,
  label,
  hint,
  error,
  required,
  requiredLabel,
  hintId,
  errorId,
  children,
}: FieldChrome & {
  id: string;
  required?: boolean;
  hintId?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && requiredLabel ? (
          <span className="ms-1 text-xs font-normal text-muted">
            ({requiredLabel})
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  requiredLabel,
  className,
  id,
  name,
  ...props
}: FieldChrome & ComponentProps<"input"> & { name: string }) {
  const controlId = id ?? name;
  const ids = fieldIds(controlId, hint, error);
  return (
    <Field
      id={controlId}
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      requiredLabel={requiredLabel}
      {...ids}
    >
      <input
        id={controlId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(controlClasses, className)}
        {...props}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  requiredLabel,
  className,
  id,
  name,
  ...props
}: FieldChrome & ComponentProps<"textarea"> & { name: string }) {
  const controlId = id ?? name;
  const ids = fieldIds(controlId, hint, error);
  return (
    <Field
      id={controlId}
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      requiredLabel={requiredLabel}
      {...ids}
    >
      <textarea
        id={controlId}
        name={name}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(controlClasses, className)}
        {...props}
      />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  requiredLabel,
  className,
  id,
  name,
  options,
  placeholder,
  ...props
}: FieldChrome &
  ComponentProps<"select"> & {
    name: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    placeholder?: string;
  }) {
  const controlId = id ?? name;
  const ids = fieldIds(controlId, hint, error);
  return (
    <Field
      id={controlId}
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      requiredLabel={requiredLabel}
      {...ids}
    >
      <select
        id={controlId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={cn(controlClasses, className)}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
