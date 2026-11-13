import Link from "next/link";
import { ArrowUpRight, MapPin, Search } from "lucide-react";
import { requireTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { asFaqs, asHours, asServices } from "@/lib/types";
import { runSeoAudit, type SeoAudit } from "@/lib/ai/agents/seo";
import { Badge } from "@/components/ui/badge";
import { SeoWorkspace } from "@/components/seo/seo-workspace";

export const dynamic = "force-dynamic";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "best",
  "for",
  "in",
  "me",
  "near",
  "of",
  "on",
  "open",
  "the",
  "to",
  "with",
]);

function coverage(keyword: string, haystack: string): "covered" | "partial" | "missing" {
  const tokens = Array.from(
    new Set(
      keyword
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    )
  );
  if (!tokens.length) return "missing";
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  if (matched === tokens.length) return "covered";
  return matched > 0 ? "partial" : "missing";
}

function isSeoAudit(value: unknown): value is SeoAudit {
  if (!value || typeof value !== "object") return false;
  const audit = value as SeoAudit;
  return typeof audit.score === "number" && Array.isArray(audit.sections) && Array.isArray(audit.actions);
}

export default async function SeoPage() {
  const session = await requireTenant();
  const database = db(session.tenantId);
  const [business, connection, posts, reviews, keywords, contents, latestRun] = await Promise.all([
    database.business.findFirst(),
    database.connection.findFirst({ where: { provider: "google_business" } }),
    database.gbpPost.findMany({ orderBy: { publishedAt: "desc" } }),
    database.gbpReview.findMany(),
    database.seoKeyword.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] }),
    database.seoContent.findMany({ orderBy: { createdAt: "desc" } }),
    database.agentRun.findFirst({
      where: { agent: "seo", action: "seo.audit" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!business) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Complete onboarding before setting up local SEO.
      </div>
    );
  }

  const fresh =
    latestRun &&
    Date.now() - latestRun.createdAt.getTime() < 3600_000 &&
    isSeoAudit(latestRun.output);
  const audit: SeoAudit = fresh
    ? (latestRun!.output as unknown as SeoAudit)
    : await runSeoAudit(session.tenantId);

  const services = asServices(business.services);
  const faqs = asFaqs(business.faqs);
  const hours = asHours(business.hours);
  const openDays = Object.values(hours).filter((day) => !day.closed).length;
  const published = posts.filter((post) => post.status === "published" && post.publishedAt);
  const recentPosts = published.filter(
    (post) => post.publishedAt && Date.now() - post.publishedAt.getTime() < 30 * 86400_000
  ).length;
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const replied = reviews.filter((review) => review.status === "replied").length;
  const replyRate = reviews.length ? replied / reviews.length : 0;

  const haystack = [
    business.name,
    business.category,
    business.city,
    business.description ?? "",
    business.seoPrimaryKeyword ?? "",
    ...business.seoServiceAreas,
    ...services.map((service) => service.name),
    ...faqs.flatMap((faq) => [faq.q, faq.a]),
    ...published.flatMap((post) => [post.title, post.body, ...post.keywords]),
    ...contents.filter((item) => item.status === "approved").flatMap((item) => [item.title, item.body]),
  ]
    .join(" ")
    .toLowerCase();

  const mapsChecks = [
    { label: "Primary category", detail: business.category, passed: Boolean(business.category) },
    { label: "Name, address & phone", detail: "NAP record", passed: Boolean(business.address && business.phone) },
    { label: "Website or booking link", detail: business.website || "Not set", passed: Boolean(business.website) },
    { label: "Opening hours", detail: `${openDays} days published`, passed: openDays >= 5 },
    { label: "Primary local keyword", detail: business.seoPrimaryKeyword || "Not set", passed: Boolean(business.seoPrimaryKeyword) },
    {
      label: "Service areas",
      detail: business.seoServiceAreas.length ? business.seoServiceAreas.join(", ") : "Not set",
      passed: business.seoServiceAreas.length >= 2,
    },
    {
      label: "Secondary categories",
      detail: business.seoSecondaryCategories.length
        ? business.seoSecondaryCategories.join(", ")
        : "Not set",
      passed: business.seoSecondaryCategories.length >= 2,
    },
    { label: "Services", detail: `${services.length} listed`, passed: services.length >= 3 },
    { label: "Recent Google posts", detail: `${recentPosts} in 30 days`, passed: recentPosts >= 2 },
    { label: "Review volume", detail: `${reviews.length} reviews`, passed: reviews.length >= 10 },
    {
      label: "Review replies",
      detail: `${Math.round(replyRate * 100)}% replied`,
      passed: replyRate >= 0.8,
    },
    { label: "Local FAQs", detail: `${faqs.length} answers`, passed: faqs.length >= 3 },
  ];
  const mapsReadiness = Math.round((mapsChecks.filter((check) => check.passed).length / mapsChecks.length) * 100);
  const mode = (connection?.meta as { mode?: string } | null)?.mode;
  const live = mode === "live";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
              <Search className="h-4.5 w-4.5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SEO &amp; Maps</h1>
              <p className="text-sm text-muted-foreground">
                {business.name} · {business.city}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={live ? "success" : "muted"} dot>
            {live ? "Live Google data" : "Sandbox profile"}
          </Badge>
          <Link
            href="/gbp"
            className="flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MapPin className="h-3.5 w-3.5" /> Google profile
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <SeoWorkspace
        audit={audit}
        keywords={keywords.map((keyword) => ({
          id: keyword.id,
          keyword: keyword.keyword,
          intent: keyword.intent,
          demand: keyword.demand,
          difficulty: keyword.difficulty,
          priority: keyword.priority,
          tracked: keyword.tracked,
          source: keyword.source,
          coverage: coverage(keyword.keyword, haystack),
        }))}
        contents={contents.map((content) => ({
          id: content.id,
          type: content.type,
          keyword: content.keyword,
          title: content.title,
          metaTitle: content.metaTitle,
          metaDescription: content.metaDescription,
          body: content.body,
          status: content.status,
          createdAt: content.createdAt.toISOString(),
        }))}
        business={{
          name: business.name,
          category: business.category,
          city: business.city,
          address: business.address,
          phone: business.phone,
          website: business.website,
          primaryKeyword: business.seoPrimaryKeyword,
          serviceAreas: business.seoServiceAreas,
          secondaryCategories: business.seoSecondaryCategories,
        }}
        reviewCount={reviews.length}
        averageRating={averageRating}
        openDays={openDays}
        recentPosts={recentPosts}
        mapsChecks={mapsChecks}
        mapsReadiness={mapsReadiness}
      />
    </div>
  );
}
