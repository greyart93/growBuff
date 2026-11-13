import { db } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { getPrompt } from "@/lib/ai/prompts";
import { logAgentRun, logAudit } from "@/lib/audit";
import { publishGbpPost, replyToGbpReview } from "@/lib/adapters/google";
import { enqueue } from "@/lib/jobs/queue";
import { asFaqs, asHours, asServices } from "@/lib/types";

type Fix = { title: string; impact: "high" | "medium" | "low"; detail: string };

export async function runGbpAudit(tenantId: string) {
  const database = db(tenantId);
  const business = await database.business.findFirst();
  if (!business) throw new Error("Business not found");
  const [publishedPosts, reviews, metrics] = await Promise.all([
    database.gbpPost.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" } }),
    database.gbpReview.findMany(),
    database.gbpMetricSnapshot.findMany({ orderBy: { date: "desc" }, take: 30 }),
  ]);

  const services = asServices(business.services);
  const hours = asHours(business.hours);
  const faqs = asFaqs(business.faqs);
  const fixes: Fix[] = [];
  let score = 20;

  const descriptionLength = business.description?.length ?? 0;
  if (descriptionLength >= 400) score += 15;
  else if (descriptionLength >= 120) score += 9;
  else fixes.push({ title: "Write a 400+ character description", impact: "high", detail: "Describe treatments, neighbourhood and what makes you different, with 3–4 local keywords." });

  if (services.length >= 3) score += 15;
  else fixes.push({ title: "Add at least 3 services with prices", impact: "high", detail: "Service-specific listings match more searches and show prices upfront." });

  if (business.website) score += 5;
  else fixes.push({ title: "Add your website or booking link", impact: "medium", detail: "A one-page site with directions and a booking button lifts website clicks." });

  const openDays = Object.values(hours).filter((day) => !day.closed).length;
  if (openDays >= 5) score += 10;
  else fixes.push({ title: "Publish accurate opening hours", impact: "medium", detail: "Incomplete hours reduce map visibility and cause missed calls." });

  if (business.languages.length >= 2) score += 5;
  else fixes.push({ title: "Add Hindi to your profile language", impact: "low", detail: "Most local searches in your area happen in Hindi." });

  if (faqs.length >= 3) score += 10;
  else fixes.push({ title: "Add 3 FAQs", impact: "medium", detail: "FAQs feed both Google answers and your WhatsApp agent." });

  // Photo hygiene is simulated in the MVP (no photo library yet).
  fixes.push({ title: "Upload 5 fresh photos this month", impact: "low", detail: "Photos with staff and the clinic interior get more direction requests." });

  const recentPosts = publishedPosts.filter(
    (post) => post.publishedAt && Date.now() - post.publishedAt.getTime() < 14 * 86400_000
  );
  if (recentPosts.length >= 2) score += 15;
  else fixes.push({ title: "Publish 2 Google posts this week", impact: "high", detail: "Weekly posts keep the profile active and surface offers in local results." });

  const replied = reviews.filter((review) => review.status === "replied").length;
  const replyRate = reviews.length ? replied / reviews.length : 0;
  if (reviews.length >= 10 && replyRate >= 0.8) score += 15;
  else if (replyRate >= 0.5) score += 8;
  else fixes.push({ title: "Reply to every Google review", impact: "high", detail: `${reviews.length - replied} review(s) are still unanswered. Replies build trust and local ranking.` });

  if (metrics.length >= 20) score += 5;

  const fallback = {
    score: Math.min(score, 98),
    band: score >= 75 ? ("good" as const) : score >= 50 ? ("fair" as const) : ("poor" as const),
    fixes: fixes.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.impact] - order[b.impact];
    }).slice(0, 6),
  };

  const prompt = getPrompt("gbp-agent");
  const generation = await generateJson<typeof fallback>({
    system: prompt.auditSystem,
    prompt: JSON.stringify({
      business: {
        name: business.name,
        category: business.category,
        city: business.city,
        description: business.description,
        website: business.website,
        languages: business.languages,
        services,
        faqs,
        openDays,
      },
      publishedPosts: publishedPosts.length,
      reviews: reviews.length,
      repliedReviews: replied,
      metricsDays: metrics.length,
    }),
    fallback,
  });

  const audit = {
    ...generation.data,
    generatedAt: new Date().toISOString(),
    metrics: {
      searchViews: metrics.reduce((total, m) => total + m.searchViews, 0),
      calls: metrics.reduce((total, m) => total + m.calls, 0),
      directions: metrics.reduce((total, m) => total + m.directions, 0),
    },
  };

  await logAgentRun({
    tenantId,
    agent: "gbp",
    action: "gbp.audit",
    input: { businessId: business.id },
    output: audit,
    model: generation.model,
    tokens: generation.tokens,
  });

  return audit;
}

export async function generateGbpPost(input: {
  tenantId: string;
  type?: string;
  topic?: string;
  scheduledAt?: Date | null;
}) {
  const database = db(input.tenantId);
  const business = await database.business.findFirst();
  if (!business) throw new Error("Business not found");
  const services = asServices(business.services);
  const keywordSeed = [business.category, business.city, services[0]?.name].filter(Boolean) as string[];
  const topic = input.topic?.trim() || `${business.category} care in ${business.city}`;

  const fallbackBody =
    input.type === "offer"
      ? `This month at ${business.name}: a complete ${services[0]?.name ?? "consultation"} with our experienced team in ${business.city}. Call us to reserve your slot.`
      : `Looking for a trusted ${business.category.toLowerCase()} in ${business.city}? ${business.name} is open and taking appointments. Save our profile for directions and call us today.`;

  const prompt = getPrompt("gbp-agent");
  const generation = await generateJson<{
    title: string;
    body: string;
    keywords: string[];
    cta: string;
  }>({
    system: prompt.postSystem,
    prompt: JSON.stringify({
      business: { name: business.name, category: business.category, city: business.city, tone: business.brandTone },
      services,
      topic,
      type: input.type ?? "update",
      language: business.languages[0] ?? "en",
    }),
    fallback: {
      title: topic.slice(0, 58),
      body: fallbackBody,
      keywords: keywordSeed,
      cta: "Call us",
    },
  });

  const post = await database.gbpPost.create({
    data: {
      tenantId: input.tenantId,
      type: input.type ?? "update",
      title: generation.data.title || topic,
      body: generation.data.body,
      keywords: generation.data.keywords?.length ? generation.data.keywords : keywordSeed,
      status: "pending_approval",
      scheduledAt: input.scheduledAt ?? null,
    },
  });

  const run = await logAgentRun({
    tenantId: input.tenantId,
    agent: "gbp",
    action: "gbp.post_drafted",
    input: { topic, type: input.type },
    output: { postId: post.id, body: post.body },
    requiresApproval: true,
    model: generation.model,
    tokens: generation.tokens,
  });
  await database.gbpPost.update({ where: { id: post.id }, data: { agentRunId: run.id } });
  return post;
}

/** Owner approves a post: publish now, or schedule it. */
export async function approveGbpPost(tenantId: string, postId: string, action: "publish" | "schedule") {
  const database = db(tenantId);
  const post = await database.gbpPost.findFirst({ where: { id: postId } });
  if (!post) throw new Error("Post not found");

  if (action === "schedule") {
    return database.gbpPost.update({
      where: { id: post.id },
      data: { status: "scheduled", scheduledAt: post.scheduledAt ?? new Date(Date.now() + 3600_000) },
    });
  }

  const published = await publishGbpPost(tenantId, {
    title: post.title,
    body: post.body,
    imageUrl: post.imageUrl,
  });
  const updated = await database.gbpPost.update({
    where: { id: post.id },
    data: { status: "published", publishedAt: new Date(), externalId: published.externalId },
  });
  await logAudit({ tenantId, actorType: "user", action: "gbp.post_published", target: post.id });
  return updated;
}

export async function generateReviewReply(tenantId: string, reviewId: string) {
  const database = db(tenantId);
  const business = await database.business.findFirst();
  const review = await database.gbpReview.findFirst({ where: { id: reviewId } });
  if (!business || !review) throw new Error("Review not found");

  const sentiment = review.rating >= 4 ? "positive" : review.rating === 3 ? "neutral" : "negative";
  const fallbackReply =
    sentiment === "negative"
      ? `We're sorry your visit didn't meet expectations, ${review.author}. Please call ${business.phone ?? "us"} so we can make it right — your feedback helps us improve.`
      : sentiment === "positive"
        ? `Thank you so much, ${review.author}! The whole team at ${business.name} is glad you had a good experience. See you next time.`
        : `Thanks for the honest feedback, ${review.author}. We'd love to understand what we can improve — please call ${business.phone ?? "us"}.`;

  const prompt = getPrompt("gbp-agent");
  const generation = await generateJson<{
    reply: string;
    sentiment: string;
    needsOwnerApproval: boolean;
  }>({
    system: prompt.reviewSystem,
    prompt: JSON.stringify({
      business: { name: business.name, category: business.category, tone: business.brandTone },
      review: { author: review.author, rating: review.rating, text: review.text },
    }),
    fallback: { reply: fallbackReply, sentiment, needsOwnerApproval: sentiment === "negative" },
  });

  const needsApproval = sentiment === "negative" || !business.autoReplyReviews;
  const updated = await database.gbpReview.update({
    where: { id: review.id },
    data: {
      sentiment: generation.data.sentiment ?? sentiment,
      reply: generation.data.reply,
      status: needsApproval ? "needs_approval" : "replied",
      repliedAt: needsApproval ? null : new Date(),
    },
  });

  if (!needsApproval) {
    await replyToGbpReview(tenantId, review.id, generation.data.reply);
  }

  await logAgentRun({
    tenantId,
    agent: "gbp",
    action: needsApproval ? "gbp.review_reply_drafted" : "gbp.review_replied",
    input: { reviewId: review.id },
    output: { reply: generation.data.reply, sentiment },
    requiresApproval: needsApproval,
    model: generation.model,
    tokens: generation.tokens,
  });

  return updated;
}

export async function approveReviewReply(tenantId: string, reviewId: string) {
  const database = db(tenantId);
  const review = await database.gbpReview.findFirst({ where: { id: reviewId } });
  if (!review?.reply) throw new Error("Draft reply missing");
  await replyToGbpReview(tenantId, review.id, review.reply);
  await logAudit({ tenantId, actorType: "user", action: "gbp.review_reply_approved", target: review.id });
  return database.gbpReview.update({
    where: { id: review.id },
    data: { status: "replied", repliedAt: new Date() },
  });
}

/** Schedules a review request to a recent customer through WhatsApp. */
export async function requestReview(tenantId: string, bookingId: string) {
  const booking = await db(tenantId).booking.findFirst({ where: { id: bookingId } });
  if (!booking?.contactId) throw new Error("Booking has no customer");
  await enqueue({
    type: "review_request",
    tenantId,
    payload: { bookingId },
    idempotencyKey: `review:${bookingId}`,
  });
  return { queued: true };
}
