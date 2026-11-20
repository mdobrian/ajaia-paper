"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DocumentEditor } from "@/components/DocumentEditor";
import type { PaperDocument, PaperUser } from "@/lib/documents";

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
      };
      setDocument(payload.document);
      setTitle(payload.document.title);
      setIsOwner(payload.isOwner);
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
  }

  async function share(event: FormEvent) {
    event.preventDefault();
    setShareMessage("");
    const response = await fetch(`/api/documents/${params.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setShareMessage(payload.error ?? "Could not share.");
      return;
    }
    setShareMessage(`Shared with ${shareEmail}. They will see it under Shared with me.`);
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
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4 text-sm">
        <a href="/" className="text-accent">
          All documents
        </a>
        <p className="text-muted">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}
          {" · "}
          {isOwner ? "Owner" : "Shared with you"}
        </p>
      </div>

      <input
        className="w-full bg-transparent font-serif text-4xl outline-none"
        value={title}
        onChange={(event) => saveTitle(event.target.value)}
        aria-label="Document title"
      />

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-8">
        <DocumentEditor
          initialHtml={document.contentHtml}
          onChange={saveHtml}
        />
      </div>

      {isOwner ? (
        <form
          onSubmit={(event) => void share(event)}
          className="mt-12 border-t border-rule pt-6"
        >
          <h2 className="font-medium">Share</h2>
          <p className="mt-1 text-sm text-muted">
            Grant another seeded user access. They can edit, but only you can share.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-64 flex-1 rounded-md border border-rule bg-paper-raised px-3 py-2"
              value={shareEmail}
              onChange={(event) => setShareEmail(event.target.value)}
              placeholder="jordan@ajaia.test"
            />
            <button className="rounded-md bg-accent px-4 py-2 text-paper-raised" type="submit">
              Share
            </button>
          </div>
          {shareMessage ? <p className="mt-2 text-sm">{shareMessage}</p> : null}
        </form>
      ) : null}
    </main>
  );
}
