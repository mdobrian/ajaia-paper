import { requireUser } from "@/lib/current-user";
import { getStore } from "@/lib/store";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a .txt or .md file to import." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const imported = getStore().importFile({
    ownerId: user.id,
    filename: file.name,
    bytes,
  });

  if (!imported.ok) {
    return Response.json({ error: imported.error }, { status: 400 });
  }
  return Response.json({ document: imported.document });
}
