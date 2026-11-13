import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { confirmAssistantAction, runAssistant } from "@/lib/ai/agents/assistant";
import { recordUsage } from "@/lib/usage";

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    confirmRunId?: string;
  };

  try {
    if (body.confirmRunId) {
      const result = await confirmAssistantAction({
        tenantId: session.tenantId,
        userId: session.userId,
        runId: body.confirmRunId,
      });
      return NextResponse.json(result);
    }

    const message = (body.message ?? "").trim();
    if (!message) return NextResponse.json({ error: "Write a message" }, { status: 400 });

    const result = await runAssistant({
      tenantId: session.tenantId,
      userId: session.userId,
      message,
    });
    await recordUsage(session.tenantId, "assistant_message");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
