import { NextResponse } from "next/server";
import { getDirectoryUsers } from "@/lib/graph";

export async function GET() {
  try {
    const users = await getDirectoryUsers();
    return NextResponse.json({ users });
  } catch (err) {
    console.error("[directory/users]", err);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
