"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState<string>(DEMO_ACCOUNTS[0].password);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not sign in.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm tracking-[0.2em] uppercase text-accent">Ajaia</p>
      <h1 className="mt-3 font-serif text-5xl">Paper</h1>
      <p className="mt-3 text-muted">
        Lightweight documents for a small team. Sign in with a seeded reviewer
        account to try sharing.
      </p>

      <form
        method="post"
        onSubmit={submit}
        className="mt-10 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            className="rounded-md border border-rule bg-paper-raised px-3 py-2 text-base"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            className="rounded-md border border-rule bg-paper-raised px-3 py-2 text-base"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          className="rounded-md bg-accent px-4 py-2.5 text-paper-raised disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-muted">Reviewer accounts</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                className="w-full rounded-md border border-rule bg-paper-raised px-3 py-3 text-left hover:border-accent"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                <span className="block font-medium">{account.name}</span>
                <span className="block text-sm text-muted">
                  {account.email} · {account.password}
                </span>
                <span className="mt-1 block text-sm">{account.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
