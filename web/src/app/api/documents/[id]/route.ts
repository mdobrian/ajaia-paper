import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const store = getStore();
  const document = store.getAccessibleDocument(user.id, id);
  if (!document) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  const isOwner = document.ownerId === user.id;
  const recipients = isOwner
    ? store.listRecipients({ userId: user.id, documentId: id })
    : null;

  return Response.json({
    document,
    isOwner,
    recipients: recipients?.ok ? recipients.recipients : [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  let body: { title?: string; contentHtml?: string };
  try {
    body = (await request.json()) as { title?: string; contentHtml?: string };
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const store = getStore();
  let document = store.getAccessibleDocument(user.id, id);
  if (!document) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  if (typeof body.title === "string") {
    const renamed = store.renameDocument({
      userId: user.id,
      documentId: id,
      title: body.title,
    });
    if (!renamed.ok) {
      const status = renamed.code === "FORBIDDEN" ? 403 : 400;
      return Response.json({ error: renamed.error }, { status });
    }
    document = renamed.document;
  }

  if (typeof body.contentHtml === "string") {
    const saved = store.saveContent({
      userId: user.id,
      documentId: id,
      contentHtml: body.contentHtml,
    });
    if (!saved.ok) {
      const status = saved.code === "FORBIDDEN" ? 403 : 400;
      return Response.json({ error: saved.error }, { status });
    }
    document = saved.document;
  }

  return Response.json({ document, isOwner: document.ownerId === user.id });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const result = getStore().deleteDocument({
    userId: user.id,
    documentId: id,
  });
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 404;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ ok: true });
}
