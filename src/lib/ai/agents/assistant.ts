import { db } from "@/lib/db";
import { getWeekSummary, getTasks } from "@/lib/insights";
import { generateGbpPost, approveGbpPost } from "@/lib/ai/agents/gbp";
import { draftCampaign, approveCampaign } from "@/lib/ai/agents/marketing";
import { logAgentRun, logAudit } from "@/lib/audit";
import type { CampaignSegment } from "@/lib/types";
import { asHours } from "@/lib/types";

export type AssistantResult = {
  reply: string;
  pendingAction?: { runId: string; label: string };
  navigate?: string;
};

function pickSegment(message: string): CampaignSegment {
  const lower = message.toLowerCase();
  if (/(birthday)/.test(lower)) return { birthdayMonth: true };
  if (/(60|two month|2 month|inactive|not (seen|visited)|miss)/.test(lower)) return { inactiveDays: 60 };
  if (/(last month|30 day|recent)/.test(lower)) return { inactiveDays: 30 };
  if (/(price|enquiry|enquired|lead)/.test(lower)) return { tags: ["price-enquiry"] };
  return { all: true };
}

export async function runAssistant(input: {
  tenantId: string;
  userId: string;
  message: string;
}): Promise<AssistantResult> {
  const database = db(input.tenantId);
  const message = input.message.trim();
  const lower = message.toLowerCase();

  // --- summary
  if (/(summary|how (are|is)|this week|report|numbers|performance)/.test(lower)) {
    const summary = await getWeekSummary(input.tenantId);
    const tasks = await getTasks(input.tenantId);
    const reply = `This week: ${summary.calls} calls from Google, ${summary.leads} new leads, ${summary.bookings} bookings and ${summary.reviews} new reviews. ${tasks.length ? `${tasks.length} thing(s) need your approval.` : "Nothing needs approval right now."}`;
    await logAgentRun({
      tenantId: input.tenantId,
      agent: "assistant",
      action: "assistant.week_summary",
      input: { message },
      output: { summary },
    });
    return { reply, navigate: "/dashboard" };
  }

  // --- hot leads
  if (/(lead|enquir|enquiries|follow up|followup)/.test(lower)) {
    const leads = await database.lead.findMany({
      where: { status: { in: ["new", "contacted"] } },
      orderBy: { score: "desc" },
      take: 5,
      include: { contact: true },
    });
    const reply = leads.length
      ? `Your hottest leads: ${leads
          .map((lead) => `${lead.contact?.name ?? lead.phone ?? "Customer"} (${lead.intent}, score ${lead.score})`)
          .join("; ")}. Open the inbox to reply.`
      : "No open leads right now. Your chat agent is capturing every enquiry automatically.";
    return { reply, navigate: "/inbox" };
  }

  // --- opening hours change (needs explicit confirmation)
  if (/(hour|timing|open|close|band)/.test(lower) && /(change|update|make|set|se|badal)/.test(lower)) {
    const times = [...message.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)].map((match) => {
      const hour = Number(match[1]);
      const minute = match[2] ?? "00";
      const meridian = match[3]?.toLowerCase();
      const h24 = meridian === "pm" && hour < 12 ? hour + 12 : meridian === "am" && hour === 12 ? 0 : hour;
      return `${String(h24).padStart(2, "0")}:${minute}`;
    });
    if (times.length < 2) {
      return { reply: "Tell me the new opening and closing time, for example: “Change weekday hours to 9:30 am to 8 pm”." };
    }
    const run = await logAgentRun({
      tenantId: input.tenantId,
      agent: "assistant",
      action: "assistant.update_hours",
      input: { message },
      output: { open: times[0], close: times[1] },
      status: "pending_approval",
      requiresApproval: true,
    });
    return {
      reply: `I'll set weekday hours to ${times[0]}–${times[1]}. This changes your public Google hours and when the chat agent offers slots. Confirm to apply?`,
      pendingAction: { runId: run.id, label: "Update opening hours" },
      navigate: "/settings",
    };
  }

  // --- GBP post
  if (/(post|google update|gbp|publish)/.test(lower) && !/(campaign|whatsapp|offer to)/.test(lower)) {
    const topic = message.replace(/^(draft|create|write|make|post)\s+(a\s+)?(google\s+)?(post|update)\s*(about|on)?\s*/i, "").trim();
    const post = await generateGbpPost({
      tenantId: input.tenantId,
      topic: topic || undefined,
      type: "update",
    });
    return {
      reply: `I drafted a Google post: “${post.title}”. It's waiting in the Google tab — approve it there and I'll publish.`,
      navigate: "/gbp",
    };
  }

  // --- campaign
  if (/(campaign|offer|send|message to|customers who|diwali|win ?back|festival)/.test(lower)) {
    const segment = pickSegment(lower);
    const goal = /(diwali|festival|holi|new year)/.test(lower)
      ? "festival"
      : /(birthday)/.test(lower)
        ? "birthday"
        : /(miss|win ?back|inactive|not (seen|visited))/.test(lower)
          ? "win_back"
          : "reactivation";
    const { campaign, audience } = await draftCampaign({
      tenantId: input.tenantId,
      goal,
      brief: message,
      segment,
    });
    return {
      reply: `I drafted “${campaign.name}” for ${audience} opted-in customer${audience === 1 ? "" : "s"}. Here's the message: “${campaign.messageBody.slice(0, 160)}…” It needs your approval before anything is sent.`,
      navigate: `/campaigns/${campaign.id}`,
    };
  }

  // --- approvals
  if (/(approval|pending|approve|review|task)/.test(lower)) {
    const tasks = await getTasks(input.tenantId);
    return {
      reply: tasks.length
        ? `You have ${tasks.length} item(s): ${tasks.map((task) => task.title).slice(0, 4).join(", ")}.`
        : "Nothing is waiting for your approval. Your agents are running on their own.",
      navigate: "/dashboard",
    };
  }

  // --- fallback
  const business = await database.business.findFirst();
  return {
    reply: `I can help with three things: get found on Google, reply to WhatsApp enquiries, and bring customers back with campaigns. Try “Draft a Diwali campaign for last month's customers” or “How was this week?”`,
    navigate: business ? "/dashboard" : "/onboarding",
  };
}

export async function confirmAssistantAction(input: {
  tenantId: string;
  userId: string;
  runId: string;
}) {
  const run = await db(input.tenantId).agentRun.findFirst({ where: { id: input.runId } });
  if (!run) throw new Error("Action not found");
  if (run.status !== "pending_approval") throw new Error("This action was already handled");

  const action = run.action;
  const output = run.output as Record<string, unknown>;

  if (action === "assistant.update_hours") {
    const database = db(input.tenantId);
    const business = await database.business.findFirst();
    if (!business) throw new Error("Business not found");
    const hours = asHours(business.hours);
    for (const key of ["mon", "tue", "wed", "thu", "fri"] as const) {
      hours[key] = { open: String(output.open), close: String(output.close) };
    }
    await database.business.update({ where: { id: business.id }, data: { hours: hours as object } });
  } else if (action === "assistant.publish_post" && output.postId) {
    await approveGbpPost(input.tenantId, String(output.postId), "publish");
  } else if (action === "assistant.send_campaign" && output.campaignId) {
    await approveCampaign(input.tenantId, String(output.campaignId));
  } else {
    throw new Error(`Unknown action: ${action}`);
  }

  await db(input.tenantId).agentRun.update({
    where: { id: run.id },
    data: { status: "approved", approvedAt: new Date() },
  });
  await logAudit({
    tenantId: input.tenantId,
    actorUserId: input.userId,
    actorType: "user",
    action: "assistant.action_confirmed",
    target: run.id,
    meta: { action },
  });

  return {
    reply:
      action === "assistant.update_hours"
        ? "Done — opening hours updated. Your Google profile and booking slots now use the new times."
        : "Done. The action is live.",
  };
}
