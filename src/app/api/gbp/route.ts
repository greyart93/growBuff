import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  approveGbpPost,
  approveReviewReply,
  generateGbpPost,
  generateReviewReply,
  runGbpAudit,
} from "@/lib/ai/agents/gbp";
import { enqueue } from "@/lib/jobs/queue";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = db(session.tenantId);
  const [posts, reviews] = await Promise.all([
    database.gbpPost.findMany({ orderBy: { createdAt: "desc" } }),
    database.gbpReview.findMany({ orderBy: { reviewedAt: "desc" } }),
  ]);
  return NextResponse.json({ posts, reviews });
}

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const database = db(session.tenantId);

  try {
    switch (action) {
      case "audit": {
        const audit = await runGbpAudit(session.tenantId);
        return NextResponse.json({ audit });
      }
      case "generate_post": {
        const post = await generateGbpPost({
          tenantId: session.tenantId,
          topic: typeof body.topic === "string" ? body.topic : undefined,
          type: typeof body.type === "string" ? body.type : "update",
          scheduledAt: typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null,
        });
        return NextResponse.json({ post });
      }
      case "post_action": {
        const postId = String(body.postId ?? "");
        const mode = body.mode === "schedule" ? "schedule" : "publish";
        if (mode === "schedule") {
          const post = await database.gbpPost.findFirst({ where: { id: postId } });
          if (!post) throw new Error("Post not found");
          const runAt = post.scheduledAt ?? new Date(Date.now() + 3600_000);
          await database.gbpPost.update({
            where: { id: post.id },
            data: { status: "scheduled", scheduledAt: runAt },
          });
          await enqueue({
            type: "gbp_publish",
            tenantId: session.tenantId,
            payload: { postId: post.id },
            runAt,
            idempotencyKey: `gbp:${post.id}`,
          });
          return NextResponse.json({ ok: true, scheduledAt: runAt });
        }
        const post = await approveGbpPost(session.tenantId, postId, "publish");
        return NextResponse.json({ post });
      }
      case "draft_reply": {
        const review = await generateReviewReply(session.tenantId, String(body.reviewId ?? ""));
        return NextResponse.json({ review });
      }
      case "approve_reply": {
        const review = await approveReviewReply(session.tenantId, String(body.reviewId ?? ""));
        return NextResponse.json({ review });
      }
      case "toggle_auto_reply": {
        const business = await database.business.findFirst();
        if (!business) throw new Error("Business not found");
        await database.business.update({
          where: { id: business.id },
          data: { autoReplyReviews: Boolean(body.enabled) },
        });
        await logAudit({
          tenantId: session.tenantId,
          actorUserId: session.userId,
          actorType: "user",
          action: "gbp.auto_reply_toggled",
          meta: { enabled: Boolean(body.enabled) },
        });
        return NextResponse.json({ ok: true });
      }
      case "request_review": {
        const bookingId = String(body.bookingId ?? "");
        await enqueue({
          type: "review_request",
          tenantId: session.tenantId,
          payload: { bookingId },
          idempotencyKey: `review:${bookingId}`,
        });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
