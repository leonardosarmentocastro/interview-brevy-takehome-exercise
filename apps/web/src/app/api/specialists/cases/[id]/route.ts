import { NextResponse } from "next/server";
import { SPECIALIST } from "@/modules/specialists/data/fixtures/specialist";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const c = SPECIALIST.cases[id];
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(c);
}
