import { NextRequest, NextResponse } from "next/server";
import { getUserDashboard } from "@/lib/data";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const data = await getUserDashboard(userId);
    return NextResponse.json({
      progression: data.progression,
      checkIns: data.checkIns,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
