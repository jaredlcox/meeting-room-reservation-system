import { NextResponse } from "next/server";
import { getRoomBySlug } from "@/lib/rooms";
import { clearHold, getActiveHold, setHold } from "@/lib/room-holds";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const hold = getActiveHold(slug);
  return NextResponse.json({
    holdActive: !!hold,
    hold,
  });
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const hold = setHold(slug);
  return NextResponse.json(
    { success: true, holdActive: true, hold },
    { status: 201 }
  );
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const room = getRoomBySlug(slug);
  if (!room) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  clearHold(slug);
  return NextResponse.json({ success: true, holdActive: false });
}
