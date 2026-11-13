import { db } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { getPrompt } from "@/lib/ai/prompts";
import { logAgentRun, logAudit } from "@/lib/audit";
import { asFaqs, asHours, asServices } from "@/lib/types";

export type SeoSection = {
  id: "profile" | "maps" | "website" | "trust" | "content";
  label: string;
  score: number;
  max: number;
  detail: string;
};

export type SeoAction = {
  area: string;
  title: string;
  impact: "high" | "medium" | "low";
  detail: string;
};

export type SeoAudit = {
  score: number;
  band: "poor" | "fair" | "good";
  sections: SeoSection[];
  actions: SeoAction[];
  generatedAt: string;
};

export type SeoKeywordIdea = {
  keyword: string;
  intent: "local" | "transactional" | "commercial" | "informational";
  demand: number;
  difficulty: number;
  priority: number;
  rationale: string;
};

export type SeoContentType =
  | "gbp_description"
  | "page_meta"
  | "service_page"
  | "local_page"
  | "faq";

type KeywordResponse = { keywords: SeoKeywordIdea[] };

type ContentResponse = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  body: string;
};

const CONTENT_TYPES = new Set<SeoContentType>([
  "gbp_description",
  "page_meta",
  "service_page",
  "local_page",
  "faq",
]);

const clamp = (value: unknown, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(Number(value) || 0)));

function areaFor(business: {
  seoServiceAreas: string[];
  city: string;
  seoPrimaryKeyword: string | null;
  category: string;
}) {
  return business.seoServiceAreas[0] || business.city;
}

function primaryKeyword(business: {
  seoPrimaryKeyword: string | null;
  category: string;
  seoServiceAreas: string[];
  city: string;
}) {
  return business.seoPrimaryKeyword?.trim() || `${business.category.toLowerCase()} in ${areaFor(business)}`;
}

function keywordsFor(business: {
  seoPrimaryKeyword: string | null;
  category: string;
  city: string;
  seoServiceAreas: string[];
  services: unknown;
}): SeoKeywordIdea[] {
  const category = business.category.toLowerCase();
  const area = areaFor(business);
  const city = business.city;
  const services = asServices(business.services);
  const serviceOne = services[0]?.name?.toLowerCase() ?? "consultation";
  const serviceTwo = services[1]?.name?.toLowerCase() ?? serviceOne;
  const serviceThree = services[2]?.name?.toLowerCase() ?? serviceOne;
  const primary = primaryKeyword(business);

  const candidates: Array<[string, SeoKeywordIdea["intent"], number, number, number, string]> = [
    [primary, "local", 82, 55, 96, "Your primary local search target."],
    [`${category} in ${area}`, "local", 78, 52, 92, "High-intent neighbourhood search."],
    [`best ${category} in ${city}`, "commercial", 72, 68, 84, "Comparison-stage search with buyer intent."],
    [`${category} near ${area}`, "local", 70, 45, 82, "Near-me style discovery query."],
    [`${serviceOne} in ${area}`, "transactional", 68, 50, 80, "Service-specific local demand."],
    [`${serviceTwo} in ${area}`, "transactional", 62, 48, 74, "Supports a service page and Google post."],
    [`${serviceThree} in ${area}`, "transactional", 58, 46, 70, "Long-tail service opportunity."],
    [`${serviceOne} cost in ${city}`, "commercial", 55, 58, 66, "Price research query for the main service."],
    [`emergency ${category} ${city}`, "transactional", 50, 64, 60, "Urgent-intent query; use only if genuinely offered."],
    [`${category} open on sunday ${city}`, "local", 42, 38, 56, "Hours-based query for weekend searchers."],
    [`family ${category} in ${area}`, "local", 40, 40, 52, "Audience-specific local modifier."],
    [`${serviceTwo} near me`, "transactional", 38, 44, 48, "Broad near-me variant for supporting content."],
  ];

  const seen = new Set<string>();
  return candidates
    .map(([keyword, intent, demand, difficulty, priority, rationale]) => ({
      keyword: keyword.replace(/\s+/g, " ").trim(),
      intent,
      demand,
      difficulty,
      priority,
      rationale,
    }))
    .filter((idea) => {
      if (!idea.keyword || seen.has(idea.keyword.toLowerCase())) return false;
      seen.add(idea.keyword.toLowerCase());
      return true;
    })
    .slice(0, 12);
}

function auditActions(input: {
  descriptionLength: number;
  servicesCount: number;
  faqsCount: number;
  hasAddress: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  openDays: number;
  hasPrimaryKeyword: boolean;
  serviceAreas: number;
  secondaryCategories: number;
  recentPosts: number;
  reviews: number;
  replyRate: number;
  approvedMeta: number;
  approvedServices: number;
  approvedLocal: number;
  approvedFaq: number;
  trackedKeywords: number;
  approvedContent: number;
}) {
  const actions: SeoAction[] = [];
  const add = (impact: SeoAction["impact"], area: string, title: string, detail: string) =>
    actions.push({ impact, area, title, detail });

  if (input.descriptionLength < 300) {
    add(
      "high",
      "Profile",
      "Rewrite the Google Business Profile description",
      "Use 500–750 characters with the primary service, neighbourhood, city and what makes the business different."
    );
  }
  if (input.servicesCount < 3) {
    add("high", "Profile", "Add at least three services", "Service listings match specific searches and give Maps more category signals.");
  }
  if (!input.hasPrimaryKeyword) {
    add("high", "Maps", "Choose one primary local keyword", "Use a natural phrase such as ‘dentist in Indiranagar’ consistently in the profile description and website.");
  }
  if (input.serviceAreas < 2) {
    add("high", "Maps", "Add the neighbourhoods you serve", "Service areas help Google understand which local searches are relevant.");
  }
  if (input.secondaryCategories < 2) {
    add("medium", "Maps", "Add relevant secondary categories", "Secondary categories widen matching without changing your primary category.");
  }
  if (!input.hasAddress || !input.hasPhone) {
    add("high", "Maps", "Complete name, address and phone", "A complete NAP record is a core local ranking and trust signal.");
  }
  if (!input.hasWebsite) {
    add("medium", "Website", "Add a website or booking link", "A useful landing page converts Maps views into calls and bookings.");
  }
  if (input.openDays < 5) {
    add("medium", "Maps", "Publish accurate opening hours", "Incomplete hours reduce visibility and cause missed calls.");
  }
  if (input.faqsCount < 3) {
    add("medium", "Website", "Add local FAQs", "Answer questions about location, parking, pricing and suitability to create useful page content.");
  }
  if (input.recentPosts < 2) {
    add("high", "Content", "Publish two Google posts this month", "Fresh posts keep the profile active and can surface offers in local results.");
  }
  if (input.reviews < 10) {
    add("medium", "Trust", "Build a steady review habit", "Ask every happy customer after their visit; review volume supports local trust.");
  }
  if (input.replyRate < 0.8) {
    add("high", "Trust", "Reply to unanswered reviews", "Replies show prospects that the business listens and improve confidence.");
  }
  if (input.approvedMeta === 0) {
    add("high", "Website", "Write a local page title and meta description", "Generate a focused title and description for the main service or home page.");
  }
  if (input.approvedServices === 0) {
    add("medium", "Website", "Create one service page", "A service-specific page with FAQs gives the website a page to rank for a commercial query.");
  }
  if (input.approvedLocal === 0) {
    add("medium", "Website", "Create one neighbourhood page", "Useful local content for the area you actually serve, not a thin doorway page.");
  }
  if (input.approvedFaq === 0) {
    add("low", "Website", "Add an FAQ content block", "Reusable answers support SEO, the WhatsApp agent and Google Business Profile Q&A.");
  }
  if (input.trackedKeywords < 5) {
    add("medium", "Content", "Track your five most important keywords", "A small focused set is easier to act on than a long list of vanity terms.");
  }
  if (input.approvedContent < 2) {
    add("low", "Content", "Approve at least two SEO assets", "Move drafts into the approved column so the team knows what is ready to publish.");
  }

  const order = { high: 0, medium: 1, low: 2 };
  return actions.sort((a, b) => order[a.impact] - order[b.impact]).slice(0, 8);
}

export async function runSeoAudit(tenantId: string): Promise<SeoAudit> {
  const database = db(tenantId);
  const business = await database.business.findFirst();
  if (!business) throw new Error("Business not found");

  const [posts, reviews, keywords, content] = await Promise.all([
    database.gbpPost.findMany({ orderBy: { publishedAt: "desc" } }),
    database.gbpReview.findMany(),
    database.seoKeyword.findMany(),
    database.seoContent.findMany(),
  ]);

  const services = asServices(business.services);
  const faqs = asFaqs(business.faqs);
  const hours = asHours(business.hours);
  const openDays = Object.values(hours).filter((day) => !day.closed).length;
  const descriptionLength = business.description?.length ?? 0;
  const publishedPosts = posts.filter((post) => post.status === "published" && post.publishedAt);
  const recentPosts = publishedPosts.filter(
    (post) => post.publishedAt && Date.now() - post.publishedAt.getTime() < 30 * 86400_000
  ).length;
  const recentTwoWeeks = publishedPosts.filter(
    (post) => post.publishedAt && Date.now() - post.publishedAt.getTime() < 14 * 86400_000
  ).length;
  const replied = reviews.filter((review) => review.status === "replied").length;
  const replyRate = reviews.length ? replied / reviews.length : 0;
  const avgRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const approved = content.filter((item) => item.status === "approved");
  const approvedMeta = approved.filter((item) => item.type === "page_meta").length;
  const approvedServices = approved.filter((item) => item.type === "service_page").length;
  const approvedLocal = approved.filter((item) => item.type === "local_page").length;
  const approvedFaq = approved.filter((item) => item.type === "faq").length;
  const trackedKeywords = keywords.filter((item) => item.tracked).length;

  let profile = 0;
  profile += descriptionLength >= 600 ? 8 : descriptionLength >= 300 ? 6 : descriptionLength >= 120 ? 4 : 0;
  profile += services.length >= 3 ? 5 : services.length >= 1 ? 3 : 0;
  profile += faqs.length >= 3 ? 4 : faqs.length >= 1 ? 2 : 0;
  profile += business.address ? 2 : 0;
  profile += business.phone ? 2 : 0;
  profile += business.website ? 2 : 0;
  profile += openDays >= 5 ? 3 : openDays >= 3 ? 2 : 0;
  profile += business.languages.length >= 2 ? 2 : 0;

  let maps = 0;
  maps += business.category ? 3 : 0;
  maps += business.seoPrimaryKeyword ? 4 : 0;
  maps += business.seoServiceAreas.length >= 2 ? 4 : business.seoServiceAreas.length === 1 ? 2 : 0;
  maps += business.seoSecondaryCategories.length >= 2 ? 3 : business.seoSecondaryCategories.length === 1 ? 1 : 0;
  maps += business.address ? 2 : 0;
  maps += business.phone ? 1 : 0;
  maps += openDays >= 5 ? 2 : 0;
  maps += recentPosts >= 2 ? 4 : recentPosts === 1 ? 2 : 0;
  maps += reviews.length >= 10 ? 3 : reviews.length > 0 ? 1 : 0;

  let website = 0;
  website += business.website ? 4 : 0;
  website += approvedMeta > 0 ? 4 : 0;
  website += approvedServices > 0 ? 4 : 0;
  website += approvedLocal > 0 ? 3 : 0;
  website += approvedFaq > 0 ? 2 : 0;
  website += business.seoPrimaryKeyword ? 3 : 0;

  let trust = 0;
  trust += reviews.length >= 10 ? 4 : reviews.length > 0 ? 2 : 0;
  trust += avgRating >= 4.5 ? 4 : avgRating >= 4 ? 2 : 0;
  trust += replyRate >= 0.8 ? 4 : replyRate >= 0.5 ? 2 : 0;
  trust += business.autoReplyReviews || replyRate > 0 ? 2 : 0;

  let contentScore = 0;
  contentScore += recentTwoWeeks >= 2 ? 4 : recentTwoWeeks === 1 ? 2 : 0;
  contentScore += trackedKeywords >= 5 ? 4 : trackedKeywords > 0 ? 2 : 0;
  contentScore += approved.length >= 2 ? 4 : approved.length === 1 ? 2 : 0;

  const sections: SeoSection[] = [
    {
      id: "profile",
      label: "Profile",
      score: profile,
      max: 28,
      detail: `${descriptionLength} character description · ${services.length} services · ${faqs.length} FAQs`,
    },
    {
      id: "maps",
      label: "Google Maps",
      score: maps,
      max: 26,
      detail: `${business.seoServiceAreas.length} service areas · ${recentPosts} posts in 30 days`,
    },
    {
      id: "website",
      label: "Website content",
      score: website,
      max: 20,
      detail: `${approved.length} approved SEO assets · ${business.website ? "website linked" : "no website linked"}`,
    },
    {
      id: "trust",
      label: "Reviews & trust",
      score: trust,
      max: 14,
      detail: `${avgRating.toFixed(1)}★ from ${reviews.length} reviews · ${Math.round(replyRate * 100)}% replied`,
    },
    {
      id: "content",
      label: "Freshness",
      score: contentScore,
      max: 12,
      detail: `${recentTwoWeeks} posts in 14 days · ${trackedKeywords} tracked keywords`,
    },
  ];

  const score = Math.min(
    100,
    sections.reduce((sum, section) => sum + section.score, 0)
  );
  const actions = auditActions({
    descriptionLength,
    servicesCount: services.length,
    faqsCount: faqs.length,
    hasAddress: Boolean(business.address),
    hasPhone: Boolean(business.phone),
    hasWebsite: Boolean(business.website),
    openDays,
    hasPrimaryKeyword: Boolean(business.seoPrimaryKeyword),
    serviceAreas: business.seoServiceAreas.length,
    secondaryCategories: business.seoSecondaryCategories.length,
    recentPosts,
    reviews: reviews.length,
    replyRate,
    approvedMeta,
    approvedServices,
    approvedLocal,
    approvedFaq,
    trackedKeywords,
    approvedContent: approved.length,
  });

  const audit: SeoAudit = {
    score,
    band: score >= 75 ? "good" : score >= 50 ? "fair" : "poor",
    sections,
    actions,
    generatedAt: new Date().toISOString(),
  };

  await logAgentRun({
    tenantId,
    agent: "seo",
    action: "seo.audit",
    input: { businessId: business.id },
    output: audit as unknown as Record<string, unknown>,
    model: "seo-rules-v1",
  });

  return audit;
}

function normalizeIdea(raw: unknown, index: number): SeoKeywordIdea | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const keyword = String(item.keyword ?? "").replace(/\s+/g, " ").trim();
  if (keyword.length < 3 || keyword.length > 90) return null;
  const intents = new Set(["local", "transactional", "commercial", "informational"]);
  const intent = intents.has(String(item.intent)) ? (String(item.intent) as SeoKeywordIdea["intent"]) : "local";
  return {
    keyword,
    intent,
    demand: clamp(item.demand ?? 50),
    difficulty: clamp(item.difficulty ?? 50),
    priority: clamp(item.priority ?? 60 - index),
    rationale: String(item.rationale ?? "Local opportunity from your business profile.").slice(0, 180),
  };
}

export async function generateSeoKeywords(tenantId: string) {
  const database = db(tenantId);
  const business = await database.business.findFirst();
  if (!business) throw new Error("Business not found");
  const services = asServices(business.services);
  const fallbackIdeas = keywordsFor({ ...business, services });
  const prompt = getPrompt("seo-agent");

  const generation = await generateJson<KeywordResponse>({
    system: prompt.keywordSystem,
    prompt: JSON.stringify({
      business: {
        name: business.name,
        category: business.category,
        city: business.city,
        areas: business.seoServiceAreas,
        primaryKeyword: business.seoPrimaryKeyword,
        services: services.map((service) => service.name),
        faqs: asFaqs(business.faqs).map((faq) => faq.q),
      },
      target: "8-12 keywords for Google Maps and the website",
    }),
    fallback: { keywords: fallbackIdeas },
    maxTokens: 1200,
  });

  const aiIdeas = Array.isArray(generation.data?.keywords) ? generation.data.keywords : [];
  const normalized = aiIdeas
    .map((idea, index) => normalizeIdea(idea, index))
    .filter((idea): idea is SeoKeywordIdea => Boolean(idea));
  const seen = new Set<string>();
  const ideas = [...normalized, ...fallbackIdeas]
    .filter((idea) => {
      const key = idea.keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);

  // Keep tracked/manual keywords; refresh the generated suggestion list.
  await database.seoKeyword.deleteMany({ where: { tracked: false, source: "generated" } });
  for (const idea of ideas) {
    await database.seoKeyword.upsert({
      where: { tenantId_keyword: { tenantId, keyword: idea.keyword } },
      create: {
        tenantId,
        keyword: idea.keyword,
        intent: idea.intent,
        demand: idea.demand,
        difficulty: idea.difficulty,
        priority: idea.priority,
        source: "generated",
      },
      update: {
        intent: idea.intent,
        demand: idea.demand,
        difficulty: idea.difficulty,
        priority: idea.priority,
      },
    });
  }

  await logAgentRun({
    tenantId,
    agent: "seo",
    action: "seo.keywords_generated",
    input: { category: business.category, city: business.city },
    output: { count: ideas.length, model: generation.model },
    model: generation.model,
    tokens: generation.tokens,
  });

  return database.seoKeyword.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function addSeoKeyword(tenantId: string, rawKeyword: string, intent = "local") {
  const keyword = rawKeyword.replace(/\s+/g, " ").trim().toLowerCase();
  if (keyword.length < 3) throw new Error("Enter a keyword with at least 3 characters");
  if (keyword.length > 90) throw new Error("Keep the keyword under 90 characters");
  const allowed = new Set(["local", "transactional", "commercial", "informational"]);
  const safeIntent = allowed.has(intent) ? intent : "local";

  const database = db(tenantId);
  const saved = await database.seoKeyword.upsert({
    where: { tenantId_keyword: { tenantId, keyword } },
    create: {
      tenantId,
      keyword,
      intent: safeIntent,
      demand: 60,
      difficulty: 50,
      priority: 75,
      tracked: true,
      source: "manual",
    },
    update: { tracked: true, intent: safeIntent },
  });
  await logAudit({
    tenantId,
    actorType: "user",
    action: "seo.keyword_tracked",
    target: saved.id,
    meta: { keyword },
  });
  return saved;
}

export async function toggleSeoKeyword(tenantId: string, id: string) {
  const database = db(tenantId);
  const keyword = await database.seoKeyword.findFirst({ where: { id } });
  if (!keyword) throw new Error("Keyword not found");
  const updated = await database.seoKeyword.update({
    where: { id: keyword.id },
    data: { tracked: !keyword.tracked },
  });
  await logAudit({
    tenantId,
    actorType: "user",
    action: updated.tracked ? "seo.keyword_tracked" : "seo.keyword_untracked",
    target: updated.id,
    meta: { keyword: updated.keyword },
  });
  return updated;
}

export async function updateSeoSettings(
  tenantId: string,
  input: { primaryKeyword?: string; serviceAreas?: string[]; secondaryCategories?: string[] }
) {
  const database = db(tenantId);
  const business = await database.business.findFirst();
  if (!business) throw new Error("Business not found");
  const clean = (values: string[] | undefined) =>
    (values ?? [])
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 10);
  const updated = await database.business.update({
    where: { id: business.id },
    data: {
      seoPrimaryKeyword: input.primaryKeyword?.replace(/\s+/g, " ").trim().slice(0, 90) || null,
      seoServiceAreas: clean(input.serviceAreas),
      seoSecondaryCategories: clean(input.secondaryCategories),
    },
  });
  await logAudit({
    tenantId,
    actorType: "user",
    action: "seo.settings_updated",
    target: business.id,
    meta: {
      primaryKeyword: updated.seoPrimaryKeyword,
      serviceAreas: updated.seoServiceAreas,
    },
  });
  return updated;
}

function fallbackContent(input: {
  type: SeoContentType;
  keyword: string;
  business: {
    name: string;
    category: string;
    city: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    description: string | null;
    brandTone: string;
    languages: string[];
    hours: unknown;
    services: unknown;
    faqs: unknown;
    seoServiceAreas: string[];
    seoPrimaryKeyword: string | null;
  };
  notes?: string;
}): ContentResponse {
  const { business, keyword, type } = input;
  const services = asServices(business.services);
  const faqs = asFaqs(business.faqs);
  const area = areaFor(business);
  const serviceOne = services[0]?.name ?? "consultation";
  const serviceList = services.slice(0, 3).map((service) => service.name).join(", ");
  const location = business.address || `${area}, ${business.city}`;
  const phone = business.phone || "call the business";
  const toneNote = input.notes?.trim() ? ` ${input.notes.trim()}` : "";
  const languageNames = business.languages
    .map((code) => (code === "en" ? "English" : code === "hi" ? "Hindi" : code))
    .join(" and ");

  if (type === "gbp_description") {
    const body =
      `${business.name} is a ${business.category.toLowerCase()} in ${area}, ${business.city}. ` +
      `We help local customers with ${serviceList || "everyday appointments"} in a ${business.brandTone} setting. ` +
      `${languageNames ? `Our team speaks ${languageNames}. ` : ""}Find us at ${location}. ` +
      `Book by phone on ${phone} or visit our website for availability. ` +
      `Whether you are searching for ${keyword} or a nearby appointment, we make it easy to get started.${toneNote}`.slice(0, 740);
    return {
      title: "Google Business Profile description",
      metaTitle: "",
      metaDescription: "",
      body,
    };
  }

  if (type === "page_meta") {
    return {
      title: "Page title & meta description",
      metaTitle: `${keyword.slice(0, 45)} | ${business.name}`.slice(0, 60),
      metaDescription:
        `${business.name} offers ${serviceOne.toLowerCase()} and more in ${area}, ${business.city}. ` +
        `Book an appointment with our local team today.`.slice(0, 160),
      body: [
        `H1: ${keyword}`,
        `H2: ${serviceOne} in ${area}`,
        `H2: Why choose ${business.name}`,
        `H2: Services available`,
        `H2: Book an appointment`,
      ].join("\n"),
    };
  }

  if (type === "service_page") {
    const body = [
      `# ${serviceOne} in ${area}`,
      "",
      `${business.name} provides ${serviceOne.toLowerCase()} for customers in ${area}, ${business.city}. ` +
        `The team works with a ${business.brandTone} approach and explains each step before starting.`,
      "",
      `## What is included`,
      ...(services.slice(0, 3).map((service) => `- ${service.name}`) || ["- A consultation with the team"]),
      "",
      `## Who it is for`,
      `Adults and families in ${area} looking for a local ${business.category.toLowerCase()} with clear pricing and easy booking.`,
      "",
      `## Local details`,
      `Find us at ${location}. Call ${phone} to check availability or ask about the right service for you.`,
      "",
      `## Frequently asked questions`,
      ...faqs.slice(0, 3).flatMap((faq) => [`### ${faq.q}`, faq.a, ""]),
      `## Book an appointment`,
      `Book online or call ${phone}. We will confirm the time and share anything you need to prepare.`,
    ].join("\n");
    return {
      title: `${serviceOne} page in ${area}`,
      metaTitle: `${serviceOne} in ${area} | ${business.name}`.slice(0, 60),
      metaDescription:
        `Looking for ${serviceOne.toLowerCase()} in ${area}? ${business.name} offers local appointments and clear guidance. Book today.`.slice(
          0,
          160
        ),
      body,
    };
  }

  if (type === "local_page") {
    const body = [
      `# ${keyword}`,
      "",
      `${business.name} is a local ${business.category.toLowerCase()} serving ${area} and nearby parts of ${business.city}. ` +
        `Book ${serviceOne.toLowerCase()} and other appointments with a team that knows the neighbourhood.`,
      "",
      `## Services in ${area}`,
      ...services.slice(0, 4).map((service) => `- ${service.name}`),
      "",
      `## Areas we serve`,
      business.seoServiceAreas.length
        ? business.seoServiceAreas.join(", ")
        : `${area}, ${business.city}`,
      "",
      `## Getting here`,
      `Our address is ${location}. Call ${phone} if you need directions, parking information or accessibility details.`,
      "",
      `## Frequently asked questions`,
      ...faqs.slice(0, 3).flatMap((faq) => [`### ${faq.q}`, faq.a, ""]),
      `## Book a local appointment`,
      `Call ${phone} or book online. Mention that you found us while searching for ${keyword}.`,
    ].join("\n");
    return {
      title: `${area} local landing page`,
      metaTitle: `${keyword.slice(0, 45)} | ${business.name}`.slice(0, 60),
      metaDescription:
        `${business.name} serves ${area} with ${serviceOne.toLowerCase()} and more. Local appointments, clear guidance and easy booking.`.slice(
          0,
          160
        ),
      body,
    };
  }

  const faqPairs = [
    ...faqs.slice(0, 3),
    {
      q: `Do you serve customers in ${area}?`,
      a: `Yes. ${business.name} is based in ${business.city} and serves ${area} and nearby areas.`,
    },
    {
      q: "How do I book an appointment?",
      a: `Call ${phone} or use the booking link on the website. The team will confirm the time and what to expect.`,
    },
  ].slice(0, 5);
  return {
    title: "Local SEO FAQs",
    metaTitle: `${business.category} FAQs ${area}`.slice(0, 60),
    metaDescription:
      `Answers about ${business.name}, ${serviceOne.toLowerCase()}, appointments and visiting our ${area} location.`.slice(
        0,
        160
      ),
    body: faqPairs.flatMap((faq) => [`Q: ${faq.q}`, `A: ${faq.a}`, ""]).join("\n"),
  };
}

export async function generateSeoContent(input: {
  tenantId: string;
  type: string;
  keyword?: string;
  notes?: string;
}) {
  if (!CONTENT_TYPES.has(input.type as SeoContentType)) throw new Error("Choose a valid content type");
  const type = input.type as SeoContentType;
  const database = db(input.tenantId);
  const business = await database.business.findFirst();
  if (!business) throw new Error("Business not found");

  const keyword = (input.keyword?.trim() || primaryKeyword(business)).slice(0, 90);
  const fallback = fallbackContent({
    type,
    keyword,
    business,
    notes: input.notes,
  });
  const prompt = getPrompt("seo-agent");

  const generation = await generateJson<ContentResponse>({
    system: prompt.contentSystem,
    prompt: JSON.stringify({
      type,
      keyword,
      notes: input.notes ?? "",
      business: {
        name: business.name,
        category: business.category,
        city: business.city,
        address: business.address,
        phone: business.phone,
        website: business.website,
        description: business.description,
        tone: business.brandTone,
        languages: business.languages,
        areas: business.seoServiceAreas,
        services: asServices(business.services),
        faqs: asFaqs(business.faqs),
        hours: asHours(business.hours),
      },
    }),
    fallback,
    maxTokens: 2200,
  });

  const data = generation.data ?? fallback;
  const content = await database.seoContent.create({
    data: {
      tenantId: input.tenantId,
      type,
      keyword,
      title: String(data.title || fallback.title).slice(0, 140),
      metaTitle: data.metaTitle ? String(data.metaTitle).slice(0, 60) : null,
      metaDescription: data.metaDescription ? String(data.metaDescription).slice(0, 160) : null,
      body: String(data.body || fallback.body).slice(0, 12000),
      status: "draft",
    },
  });

  const run = await logAgentRun({
    tenantId: input.tenantId,
    agent: "seo",
    action: "seo.content_drafted",
    input: { type, keyword, notes: input.notes ?? "" },
    output: { contentId: content.id, title: content.title },
    requiresApproval: true,
    model: generation.model,
    tokens: generation.tokens,
  });
  await logAudit({
    tenantId: input.tenantId,
    actorType: "ai",
    action: "seo.content_drafted",
    target: content.id,
    meta: { type, keyword, runId: run.id },
  });

  return content;
}

export async function approveSeoContent(tenantId: string, id: string) {
  const database = db(tenantId);
  const content = await database.seoContent.findFirst({ where: { id } });
  if (!content) throw new Error("Content not found");
  const updated = await database.seoContent.update({
    where: { id: content.id },
    data: { status: "approved" },
  });
  await logAudit({
    tenantId,
    actorType: "user",
    action: "seo.content_approved",
    target: content.id,
    meta: { type: content.type, keyword: content.keyword },
  });
  return updated;
}

export async function updateSeoContent(
  tenantId: string,
  id: string,
  input: { title?: string; metaTitle?: string; metaDescription?: string; body?: string }
) {
  const database = db(tenantId);
  const content = await database.seoContent.findFirst({ where: { id } });
  if (!content) throw new Error("Content not found");
  const updated = await database.seoContent.update({
    where: { id: content.id },
    data: {
      title: input.title?.trim().slice(0, 140) || content.title,
      metaTitle: input.metaTitle?.trim().slice(0, 60) || null,
      metaDescription: input.metaDescription?.trim().slice(0, 160) || null,
      body: input.body?.trim().slice(0, 12000) || content.body,
      status: "draft",
    },
  });
  await logAudit({
    tenantId,
    actorType: "user",
    action: "seo.content_updated",
    target: content.id,
    meta: { type: content.type, keyword: content.keyword },
  });
  return updated;
}
