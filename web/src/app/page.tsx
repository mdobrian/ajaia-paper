"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Library, PaperDocument, PaperUser } from "@/lib/documents";

export default function LibraryPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<PaperUser | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setError("");
    const body = new FormData();
    body.append("file", file);
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
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />

      {error ? <p className="mt-4 text-danger">{error}</p> : null}
      <p className="mt-4 text-sm text-muted">
        Supported uploads: <strong>.txt</strong> and <strong>.md</strong> only. Word, PDF, and images are rejected.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Owned</h2>
        <DocumentCards documents={library.owned} empty="You have not created a document yet." />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Shared with me</h2>
        <DocumentCards documents={library.shared} empty="Nothing has been shared with you yet." />
      </section>
    </main>
  );
}

function DocumentCards({
  documents,
  empty,
}: {
  documents: PaperDocument[];
  empty: string;
}) {
  if (documents.length === 0) {
    return <p className="mt-3 text-muted">{empty}</p>;
  }

  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
      {documents.map((document) => (
        <li key={document.id}>
          <a
            href={`/d/${document.id}`}
            className="block rounded-lg border border-rule bg-paper-raised px-4 py-4 hover:border-accent"
          >
            <h3 className="font-serif text-xl">{document.title}</h3>
            <p className="mt-2 text-sm text-muted">
              Updated {new Date(document.updatedAt).toLocaleString()}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
