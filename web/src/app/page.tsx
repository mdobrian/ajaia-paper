"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Library, PaperDocument, PaperUser } from "@/lib/documents";
import { ConfirmTypedDialog } from "@/components/ConfirmTypedDialog";
import {
  DELETE_CONFIRM_WORD,
  LEAVE_CONFIRM_WORD,
} from "@/lib/confirm-delete";
import {
  inspectMarkdown,
  type MarkdownIssue,
} from "@/lib/markdown-structure";

export default function LibraryPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<PaperUser | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingMarkdown, setPendingMarkdown] = useState<{
    file: File;
    issues: MarkdownIssue[];
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PaperDocument | null>(null);
  const [pendingLeave, setPendingLeave] = useState<PaperDocument | null>(null);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/me");
      if (me.status === 401) {
        router.replace("/login");
        return;
      }
      const meJson = (await me.json()) as { user: PaperUser };
      setUser(meJson.user);
      const docs = await fetch("/api/documents");
      const docsJson = (await docs.json()) as { library: Library };
      setLibrary(docsJson.library);
    }
    void load();
  }, [router]);

  async function createDocument() {
    setBusy(true);
    const response = await fetch("/api/documents", { method: "POST" });
    const payload = (await response.json()) as { document?: PaperDocument; error?: string };
    setBusy(false);
    if (!payload.document) {
      setError(payload.error ?? "Could not create a document.");
      return;
    }
    router.push(`/d/${payload.document.id}`);
  }

  async function importFile(file: File) {
    setError("");
    if (/\.md$/i.test(file.name)) {
      const text = await file.text();
      const report = inspectMarkdown(text);
      if (report.issues.length > 0) {
        setPendingMarkdown({ file, issues: report.issues });
        return;
      }
    }
    await uploadImport(file, false);
  }

  async function uploadImport(file: File, repair: boolean) {
    setBusy(true);
    setPendingMarkdown(null);
    const body = new FormData();
    body.append("file", file);
    if (repair) {
      body.append("repair", "1");
    }
    const response = await fetch("/api/documents/import", { method: "POST", body });
    const payload = (await response.json()) as { document?: PaperDocument; error?: string };
    setBusy(false);
    if (!payload.document) {
      setError(payload.error ?? "Could not import that file.");
      return;
    }
    router.push(`/d/${payload.document.id}`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function refreshLibrary() {
    const docs = await fetch("/api/documents");
    const docsJson = (await docs.json()) as { library: Library };
    setLibrary(docsJson.library);
  }

  async function removeOwned(document: PaperDocument) {
    setPendingDelete(null);
    setBusy(true);
    const response = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not delete.");
      return;
    }
    await refreshLibrary();
  }

  async function leaveShared(document: PaperDocument) {
    setPendingLeave(null);
    setBusy(true);
    const response = await fetch(`/api/documents/${document.id}/leave`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not remove that share.");
      return;
    }
    await refreshLibrary();
  }

  if (!user || !library) {
    return <main className="p-8 text-muted">Loading library…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div>
          <p className="text-sm tracking-[0.2em] uppercase text-accent">Paper</p>
          <h1 className="mt-1 font-serif text-4xl">Documents</h1>
          <p className="mt-2 text-muted">
            Signed in as {user.name} ({user.email})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md bg-accent px-4 py-2 text-paper-raised disabled:opacity-60"
            onClick={() => void createDocument()}
            disabled={busy}
            type="button"
          >
            New document
          </button>
          <button
            className="rounded-md border border-rule bg-paper-raised px-4 py-2 disabled:opacity-60"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            type="button"
          >
            Import .txt or .md
          </button>
          <button className="rounded-md px-4 py-2 text-muted" onClick={() => void logout()} type="button">
            Sign out
          </button>
        </div>
      </header>

      <input
        ref={fileInput}
        className="hidden"
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        aria-label="Upload a .txt or .md file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />

      {error ? <p className="mt-4 text-danger">{error}</p> : null}
      {pendingMarkdown ? (
        <div className="mt-4 rounded-lg border border-shared bg-shared-soft px-4 py-4">
          <p className="font-medium text-shared">
            {pendingMarkdown.file.name} is Markdown, but some lines fall outside
            the structure Paper converts.
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {pendingMarkdown.issues.map((issue) => (
              <li key={`${issue.code}-${issue.line}`}>{issue.message}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-paper-raised disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={() => void uploadImport(pendingMarkdown.file, true)}
            >
              Fix and import
            </button>
            <button
              className="rounded-md border border-rule bg-paper-raised px-3 py-1.5 text-sm disabled:opacity-60"
              type="button"
              disabled={busy}
              onClick={() => void uploadImport(pendingMarkdown.file, false)}
            >
              Import as-is
            </button>
            <button
              className="rounded-md px-3 py-1.5 text-sm text-muted"
              type="button"
              disabled={busy}
              onClick={() => setPendingMarkdown(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <p className="mt-4 text-sm text-muted">
        Supported uploads: <strong>.txt</strong> and <strong>.md</strong> only. Word, PDF, and images are rejected.
        Markdown is checked against headings, lists, and bold before import.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-owned">Owned</h2>
        <DocumentCards
          kind="owned"
          documents={library.owned}
          empty="You have not created a document yet."
          actionLabel="Delete"
          onAction={(document) => setPendingDelete(document)}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-shared">Shared with me</h2>
        <DocumentCards
          kind="shared"
          documents={library.shared}
          empty="Nothing has been shared with you yet."
          actionLabel="Leave"
          onAction={(document) => setPendingLeave(document)}
        />
      </section>
      {pendingDelete ? (
        <ConfirmTypedDialog
          word={DELETE_CONFIRM_WORD}
          heading="Delete this document?"
          description={`“${pendingDelete.title}” will be removed for everyone who has access. This cannot be undone. Type ${DELETE_CONFIRM_WORD} to confirm.`}
          confirmLabel="Delete"
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void removeOwned(pendingDelete)}
        />
      ) : null}
      {pendingLeave ? (
        <ConfirmTypedDialog
          word={LEAVE_CONFIRM_WORD}
          heading="Leave this document?"
          description={`“${pendingLeave.title}” will leave your Shared with me list. The owner still has it. Type ${LEAVE_CONFIRM_WORD} to confirm.`}
          confirmLabel="Leave"
          busy={busy}
          onCancel={() => setPendingLeave(null)}
          onConfirm={() => void leaveShared(pendingLeave)}
        />
      ) : null}
    </main>
  );
}

function DocumentCards({
  kind,
  documents,
  empty,
  actionLabel,
  onAction,
}: {
  kind: "owned" | "shared";
  documents: PaperDocument[];
  empty: string;
  actionLabel: string;
  onAction: (document: PaperDocument) => void;
}) {
  if (documents.length === 0) {
    return <p className="mt-3 text-muted">{empty}</p>;
  }

  const isOwned = kind === "owned";

  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {documents.map((document) => (
        <li
          key={document.id}
          className={
            isOwned
              ? "rounded-lg border border-[#7aa394] border-l-8 border-l-owned bg-[#b7d4c8] px-4 py-4"
              : "rounded-lg border border-[#8b94c2] border-l-8 border-l-shared bg-[#c5cbe8] px-4 py-4"
          }
        >
          <a href={`/d/${document.id}`} className="block">
            <p
              className={
                isOwned
                  ? "text-xs font-medium uppercase tracking-wide text-owned"
                  : "text-xs font-medium uppercase tracking-wide text-shared"
              }
            >
              {isOwned ? "Yours" : "Shared"}
            </p>
            <h3 className="mt-1 font-serif text-xl">{document.title}</h3>
            <p className="mt-2 text-sm text-muted">
              Updated {new Date(document.updatedAt).toLocaleString()}
            </p>
          </a>
          <button
            className="mt-3 text-sm text-danger"
            type="button"
            onClick={() => onAction(document)}
          >
            {actionLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}
