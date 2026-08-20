import { NextResponse } from "next/server";

import { AuthForbiddenError, AuthRequiredError, requireAdminRole, requireAuth } from "@/lib/auth";
import { getCollections } from "@/lib/collections";
import { dailyNoteSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    requireAdminRole(user);
    const payload = dailyNoteSchema.parse(await request.json());
    const { dailyNotes } = await getCollections();
    const now = new Date();
    await dailyNotes.updateOne(
      { dateKey: payload.dateKey },
      {
        $set: {
          note: payload.note,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );
    const note = await dailyNotes.findOne({ dateKey: payload.dateKey });

    return NextResponse.json({ ...note, _id: note?._id?.toString() });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (error instanceof AuthForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "No se pudo guardar la nota.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
