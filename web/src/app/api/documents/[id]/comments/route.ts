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
  const result = getStore().listComments({
    userId: user.id,
    documentId: id,
  });
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : 404;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ comments: result.comments });
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
  let body: { body?: string; quote?: string; anchorId?: string };
  try {
    body = (await request.json()) as {
      body?: string;
      quote?: string;
      anchorId?: string;
    };
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const result = getStore().addComment({
    userId: user.id,
    documentId: id,
    body: body.body ?? "",
    quote: body.quote,
    anchorId: body.anchorId,
  });
  if (!result.ok) {
    const status =
      result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ comment: result.comment });
}
