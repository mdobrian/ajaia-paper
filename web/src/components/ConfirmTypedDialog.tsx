"use client";

import { FormEvent, useState } from "react";
import { isTypedConfirmation } from "@/lib/confirm-delete";

export function ConfirmTypedDialog({
  word,
  heading,
  description,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  word: string;
  heading: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const canConfirm = isTypedConfirmation(typed, word);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canConfirm || busy) {
      return;
    }
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <form
        className="w-full max-w-md rounded-lg border border-rule bg-paper-raised p-5 shadow-lg"
        onSubmit={submit}
      >
        <p className="text-sm font-medium uppercase tracking-wide text-danger">
          Are you sure?
        </p>
        <h2 className="mt-2 font-serif text-2xl">{heading}</h2>
        <p className="mt-3 text-sm text-muted">{description}</p>
        <label className="mt-4 block text-sm">
          <span className="text-muted">Type {word}</span>
          <input
            autoFocus
            className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-2"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-md border border-rule px-3 py-1.5"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-danger px-3 py-1.5 text-paper-raised disabled:opacity-40"
            type="submit"
            disabled={!canConfirm || busy}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
