import { NextResponse } from "next/server";
import { POLICY_LINES } from "@/shared/policies/data/fixtures/policies";
export function GET() {
  return NextResponse.json({ lines: POLICY_LINES });
}
