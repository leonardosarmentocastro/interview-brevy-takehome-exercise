import { NextResponse } from "next/server";
import { SPECIALIST } from "@/modules/specialists/data/fixtures/specialist";

export function GET() {
  return NextResponse.json(SPECIALIST);
}
