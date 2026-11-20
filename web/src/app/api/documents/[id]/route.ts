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
  const document = getStore().getAccessibleDocument(user.id, id);
  if (!document) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  return Response.json({
    document,
    isOwner: document.ownerId === user.id,
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
