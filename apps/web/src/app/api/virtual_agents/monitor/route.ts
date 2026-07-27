import { NextResponse } from "next/server";
import { MONITOR } from "@/modules/virtual_agents/data/fixtures/monitor";

export function GET() {
  return NextResponse.json(MONITOR);
}
