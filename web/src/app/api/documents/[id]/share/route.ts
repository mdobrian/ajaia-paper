import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

function shareStatus(code: string): number {
  if (code === "FORBIDDEN") return 403;
  if (code === "NOT_FOUND") return 404;
  return 400;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const result = getStore().listRecipients({
    userId: user.id,
    documentId: id,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: shareStatus(result.code) });
  }
  return Response.json({ recipients: result.recipients });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const store = getStore();
  const result = store.shareDocument({
    documentId: id,
    ownerId: user.id,
    recipientEmail: body.email ?? "",
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: shareStatus(result.code) });
  }

  const recipients = store.listRecipients({
    userId: user.id,
    documentId: id,
  });
  return Response.json({
    ok: true,
    recipients: recipients.ok ? recipients.recipients : [],
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const store = getStore();
  const result = store.unshareDocument({
    documentId: id,
    ownerId: user.id,
    recipientEmail: body.email ?? "",
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: shareStatus(result.code) });
  }

  const recipients = store.listRecipients({
    userId: user.id,
    documentId: id,
  });
  return Response.json({
    ok: true,
    recipients: recipients.ok ? recipients.recipients : [],
  });
}
