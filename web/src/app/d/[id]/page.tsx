"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConfirmTypedDialog } from "@/components/ConfirmTypedDialog";
import {
  DELETE_CONFIRM_WORD,
  LEAVE_CONFIRM_WORD,
} from "@/lib/confirm-delete";
import { DocumentEditor } from "@/components/DocumentEditor";
import type {
  DocumentVersion,
  PaperComment,
  PaperDocument,
  PaperUser,
  Recipient,
} from "@/lib/documents";

type SaveState = "saved" | "saving" | "error";

export default function DocumentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<PaperUser | null>(null);
  const [document, setDocument] = useState<PaperDocument | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [shareEmail, setShareEmail] = useState("jordan@ajaia.test");
  const [shareMessage, setShareMessage] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [editorKey, setEditorKey] = useState(0);
  const [comments, setComments] = useState<PaperComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentQuote, setCommentQuote] = useState("");
  const [commentAnchorId, setCommentAnchorId] = useState("");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await fetch("/api/me");
      if (me.status === 401) {
        router.replace("/login");
        return;
      }
      const meJson = (await me.json()) as { user: PaperUser };
      setUser(meJson.user);

      const response = await fetch(`/api/documents/${params.id}`);
      if (response.status === 404) {
        setError("You do not have access to this document.");
        return;
      }
      const payload = (await response.json()) as {
        document: PaperDocument;
        isOwner: boolean;
        recipients?: Recipient[];
      };
      setDocument(payload.document);
      setTitle(payload.document.title);
      setIsOwner(payload.isOwner);
      setRecipients(payload.recipients ?? []);

      const history = await fetch(`/api/documents/${params.id}/versions`);
      if (history.ok) {
        const historyJson = (await history.json()) as { versions: DocumentVersion[] };
        setVersions(historyJson.versions);
      }

      const threads = await fetch(`/api/documents/${params.id}/comments`);
      if (threads.ok) {
        const threadsJson = (await threads.json()) as { comments: PaperComment[] };
        setComments(threadsJson.comments);
      }
    }
    void load();
  }, [params.id, router]);

  const saveTitle = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return (nextTitle: string) => {
      setTitle(nextTitle);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void patch({ title: nextTitle });
      }, 500);
    };
  }, [params.id]);

  const saveHtml = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return (html: string) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void patch({ contentHtml: html });
      }, 700);
    };
  }, [params.id]);

  async function patch(body: { title?: string; contentHtml?: string }) {
    setSaveState("saving");
    const response = await fetch(`/api/documents/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      document?: PaperDocument;
      error?: string;
    };
    if (!response.ok || !payload.document) {
      setSaveState("error");
      setError(payload.error ?? "Could not save.");
      return;
    }
    setDocument(payload.document);
    setSaveState("saved");
    setError("");
    await refreshVersions();
  }

  async function refreshVersions() {
    const history = await fetch(`/api/documents/${params.id}/versions`);
    if (!history.ok) {
      return;
    }
    const historyJson = (await history.json()) as { versions: DocumentVersion[] };
    setVersions(historyJson.versions);
  }

  async function restore(versionId: string) {
    if (!window.confirm("Restore this version? The current text stays in history.")) {
      return;
    }
    setBusy(true);
    const response = await fetch(
      `/api/documents/${params.id}/versions/${versionId}/restore`,
      { method: "POST" },
    );
    const payload = (await response.json()) as {
      document?: PaperDocument;
      error?: string;
    };
    setBusy(false);
    if (!payload.document) {
      setError(payload.error ?? "Could not restore that version.");
      return;
    }
    setDocument(payload.document);
    setTitle(payload.document.title);
    setEditorKey((key) => key + 1);
    await refreshVersions();
  }

  async function refreshComments() {
    const threads = await fetch(`/api/documents/${params.id}/comments`);
    if (!threads.ok) {
      return;
    }
    const threadsJson = (await threads.json()) as { comments: PaperComment[] };
    setComments(threadsJson.comments);
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/documents/${params.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: commentBody,
        quote: commentQuote,
        anchorId: commentAnchorId,
      }),
    });
    const payload = (await response.json()) as {
      comment?: PaperComment;
      error?: string;
    };
    if (!payload.comment) {
      setError(payload.error ?? "Could not add comment.");
      return;
    }
    setCommentBody("");
    setCommentQuote("");
    setCommentAnchorId("");
    setActiveCommentId(payload.comment.id);
    await refreshComments();
  }

  async function resolveComment(commentId: string) {
    const response = await fetch(
      `/api/documents/${params.id}/comments/${commentId}/resolve`,
      { method: "POST" },
    );
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Could not resolve.");
      return;
    }
    await refreshComments();
  }

  async function removeComment(commentId: string) {
    const response = await fetch(`/api/documents/${params.id}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Could not delete comment.");
      return;
    }
    if (activeCommentId === commentId) {
      setActiveCommentId(null);
    }
    await refreshComments();
  }

  async function share(event: FormEvent) {
    event.preventDefault();
    setShareMessage("");
    const response = await fetch(`/api/documents/${params.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail }),
    });
    const payload = (await response.json()) as {
      error?: string;
      recipients?: Recipient[];
    };
    if (!response.ok) {
      setShareMessage(payload.error ?? "Could not share.");
      return;
    }
    setRecipients(payload.recipients ?? []);
    setShareMessage(`Shared with ${shareEmail}. They will see it under Shared with me.`);
  }

  async function unshare(email: string) {
    setShareMessage("");
    const response = await fetch(`/api/documents/${params.id}/share`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json()) as {
      error?: string;
      recipients?: Recipient[];
    };
    if (!response.ok) {
      setShareMessage(payload.error ?? "Could not unshare.");
      return;
    }
    setRecipients(payload.recipients ?? []);
    setShareMessage(`Removed access for ${email}.`);
  }

  async function removeDocument() {
    setPendingDelete(false);
    setBusy(true);
    const response = await fetch(`/api/documents/${params.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not delete.");
      return;
    }
    router.push("/");
  }

  async function leave() {
    setPendingLeave(false);
    setBusy(true);
    const response = await fetch(`/api/documents/${params.id}/leave`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not leave.");
      return;
    }
    router.push("/");
  }

  async function duplicate() {
    setBusy(true);
    const response = await fetch(`/api/documents/${params.id}/duplicate`, {
      method: "POST",
    });
    const payload = (await response.json()) as {
      document?: PaperDocument;
      error?: string;
    };
    setBusy(false);
    if (!payload.document) {
      setError(payload.error ?? "Could not duplicate.");
      return;
    }
    router.push(`/d/${payload.document.id}`);
  }

  if (error && !document) {
    return (
      <main className="p-8">
        <p className="text-danger">{error}</p>
        <a className="mt-4 inline-block text-accent" href="/">
          Back to documents
        </a>
      </main>
    );
  }

  if (!user || !document) {
    return <main className="p-8 text-muted">Opening document…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 text-sm">
        <a href="/" className="text-accent">
          All documents
        </a>
        <p className="flex items-center gap-2 text-muted">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}
          <span
            className={
              isOwner
                ? "rounded-full bg-owned-soft px-2.5 py-0.5 text-owned"
                : "rounded-full bg-shared-soft px-2.5 py-0.5 text-shared"
            }
          >
            {isOwner ? "Owner" : "Shared with you"}
          </span>
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
        <div>
      <input
        className="w-full bg-transparent font-serif text-4xl outline-none"
        value={title}
        onChange={(event) => saveTitle(event.target.value)}
        aria-label="Document title"
      />

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <a
          className="rounded-md border border-rule bg-paper-raised px-3 py-1.5"
          href={`/api/documents/${params.id}/export?format=md`}
        >
          Export .md
        </a>
        <a
          className="rounded-md border border-rule bg-paper-raised px-3 py-1.5"
          href={`/api/documents/${params.id}/export?format=txt`}
        >
          Export .txt
        </a>
        <a
          className="rounded-md border border-rule bg-paper-raised px-3 py-1.5"
          href={`/api/documents/${params.id}/export?format=pdf`}
        >
          Export PDF
        </a>
        <button
          className="rounded-md border border-rule bg-paper-raised px-3 py-1.5 disabled:opacity-60"
          type="button"
          disabled={busy}
          onClick={() => void duplicate()}
        >
          Duplicate
        </button>
        {isOwner ? (
          <button
            className="rounded-md px-3 py-1.5 text-danger disabled:opacity-60"
            type="button"
            disabled={busy}
            onClick={() => setPendingDelete(true)}
          >
            Delete
          </button>
        ) : (
          <button
            className="rounded-md px-3 py-1.5 text-danger disabled:opacity-60"
            type="button"
            disabled={busy}
            onClick={() => setPendingLeave(true)}
          >
            Leave
          </button>
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-8">
        <DocumentEditor
          key={editorKey}
          initialHtml={document.contentHtml}
          onChange={saveHtml}
          activeCommentId={activeCommentId}
          onSelectComment={setActiveCommentId}
          onStartComment={({ commentId, quote }) => {
            setCommentAnchorId(commentId);
            setCommentQuote(quote);
            setActiveCommentId(commentId || null);
          }}
        />
      </div>

      <section className="mt-12 border-t border-rule pt-6">
        <h2 className="font-medium">Version history</h2>
        <p className="mt-1 text-sm text-muted">
          A snapshot is stored when the body changes. Title-only edits update the latest snapshot.
        </p>
        {versions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No history yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {versions.map((version, index) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule bg-paper-raised px-3 py-2 text-sm"
              >
                <span>
                  {new Date(version.createdAt).toLocaleString()}
                  {version.createdByName ? ` · ${version.createdByName}` : ""}
                  {index === 0 ? " · current" : ""}
                </span>
                {index === 0 ? null : (
                  <button
                    className="text-accent disabled:opacity-60"
                    type="button"
                    disabled={busy}
                    onClick={() => void restore(version.id)}
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner ? (
        <form
          onSubmit={(event) => void share(event)}
          className="mt-12 border-t border-rule pt-6"
        >
          <h2 className="font-medium">Share</h2>
          <p className="mt-1 text-sm text-muted">
            Grant another seeded user access. They can edit, but only you can share or unshare.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-64 flex-1 rounded-md border border-rule bg-paper-raised px-3 py-2"
              value={shareEmail}
              onChange={(event) => setShareEmail(event.target.value)}
              placeholder="jordan@ajaia.test"
              aria-label="Recipient email"
            />
            <button className="rounded-md bg-accent px-4 py-2 text-paper-raised" type="submit">
              Share
            </button>
          </div>
          {shareMessage ? <p className="mt-2 text-sm">{shareMessage}</p> : null}
          {recipients.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {recipients.map((recipient) => (
                <li
                  key={recipient.email}
                  className="flex items-center justify-between gap-3 rounded-md border border-rule bg-paper-raised px-3 py-2 text-sm"
                >
                  <span>
                    {recipient.name} ({recipient.email})
                  </span>
                  <button
                    className="text-danger"
                    type="button"
                    onClick={() => void unshare(recipient.email)}
                  >
                    Unshare
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Not shared with anyone yet.</p>
          )}
        </form>
      ) : null}
        </div>

        <aside className="mt-12 lg:mt-0">
          <h2 className="font-medium">Comments</h2>
          <p className="mt-1 text-sm text-muted">
            Select text and click Comment to attach a thread. Anyone with access can
            comment. Only the commenter or owner can delete.
          </p>
          <form onSubmit={(event) => void submitComment(event)} className="mt-4">
            {commentQuote ? (
              <p className="mb-2 line-clamp-2 text-sm text-muted">“{commentQuote}”</p>
            ) : null}
            <textarea
              className="min-h-24 w-full rounded-md border border-rule bg-paper-raised px-3 py-2 text-sm"
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Write a comment…"
              aria-label="Comment"
            />
            <button
              className="mt-2 rounded-md bg-accent px-3 py-1.5 text-sm text-paper-raised"
              type="submit"
            >
              Comment
            </button>
          </form>
          <ul className="mt-4 space-y-3">
            {comments.length === 0 ? (
              <li className="text-sm text-muted">No comments yet.</li>
            ) : (
              comments.map((comment) => (
                <li
                  key={comment.id}
                  className={`rounded-md border px-3 py-3 text-sm ${
                    activeCommentId === comment.id || activeCommentId === comment.anchorId
                      ? "border-shared bg-shared-soft"
                      : "border-rule bg-paper-raised"
                  } ${comment.resolvedAt ? "opacity-60" : ""}`}
                >
                  <button
                    className="block w-full text-left"
                    type="button"
                    onClick={() => setActiveCommentId(comment.anchorId || comment.id)}
                  >
                    <p className="font-medium">
                      {comment.authorName}
                      {comment.resolvedAt ? " · resolved" : ""}
                    </p>
                    {comment.quote ? (
                      <p className="mt-1 text-muted">“{comment.quote}”</p>
                    ) : null}
                    <p className="mt-1">{comment.body}</p>
                  </button>
                  <div className="mt-2 flex gap-3">
                    {comment.resolvedAt ? null : (
                      <button
                        className="text-accent"
                        type="button"
                        onClick={() => void resolveComment(comment.id)}
                      >
                        Resolve
                      </button>
                    )}
                    {user.id === comment.authorId || isOwner ? (
                      <button
                        className="text-danger"
                        type="button"
                        onClick={() => void removeComment(comment.id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
      {pendingDelete && document ? (
        <ConfirmTypedDialog
          word={DELETE_CONFIRM_WORD}
          heading="Delete this document?"
          description={`“${document.title}” will be removed for everyone who has access. This cannot be undone. Type ${DELETE_CONFIRM_WORD} to confirm.`}
          confirmLabel="Delete"
          busy={busy}
          onCancel={() => setPendingDelete(false)}
          onConfirm={() => void removeDocument()}
        />
      ) : null}
      {pendingLeave && document ? (
        <ConfirmTypedDialog
          word={LEAVE_CONFIRM_WORD}
          heading="Leave this document?"
          description={`“${document.title}” will leave your Shared with me list. The owner still has it. Type ${LEAVE_CONFIRM_WORD} to confirm.`}
          confirmLabel="Leave"
          busy={busy}
          onCancel={() => setPendingLeave(false)}
          onConfirm={() => void leave()}
        />
      ) : null}
    </main>
  );
}
