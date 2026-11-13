"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  Globe2,
  ListChecks,
  Loader2,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";

type Audit = {
  score: number;
  band: "poor" | "fair" | "good";
  sections: Array<{ id: string; label: string; score: number; max: number; detail: string }>;
  actions: Array<{ area: string; title: string; impact: "high" | "medium" | "low"; detail: string }>;
  generatedAt: string;
};

type Keyword = {
  id: string;
  keyword: string;
  intent: string;
  demand: number;
  difficulty: number;
  priority: number;
  tracked: boolean;
  source: string;
  coverage: "covered" | "partial" | "missing";
};

type Content = {
  id: string;
  type: string;
  keyword: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  body: string;
  status: string;
  createdAt: string;
};

type MapsCheck = { label: string; detail: string; passed: boolean };

type Business = {
  name: string;
  category: string;
  city: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  primaryKeyword: string | null;
  serviceAreas: string[];
  secondaryCategories: string[];
};

const CONTENT_LABELS: Record<string, string> = {
  gbp_description: "Google profile description",
  page_meta: "Page title & meta",
  service_page: "Service page",
  local_page: "Local landing page",
  faq: "FAQ block",
};

const CONTENT_TYPES = Object.entries(CONTENT_LABELS);

const scoreTone = (score: number) => (score >= 75 ? "success" : score >= 50 ? "warning" : "danger");
const coverageTone = (coverage: Keyword["coverage"]) =>
  coverage === "covered" ? "success" : coverage === "partial" ? "warning" : "danger";

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

export function SeoWorkspace({
  audit,
  keywords,
  contents,
  business,
  reviewCount,
  averageRating,
  openDays,
  recentPosts,
  mapsChecks,
  mapsReadiness,
}: {
  audit: Audit;
  keywords: Keyword[];
  contents: Content[];
  business: Business;
  reviewCount: number;
  averageRating: number;
  openDays: number;
  recentPosts: number;
  mapsChecks: MapsCheck[];
  mapsReadiness: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywordIntent, setKeywordIntent] = useState("local");
  const [primaryKeyword, setPrimaryKeyword] = useState(business.primaryKeyword ?? "");
  const [areas, setAreas] = useState(business.serviceAreas.join(", "));
  const [categories, setCategories] = useState(business.secondaryCategories.join(", "));
  const [contentType, setContentType] = useState("page_meta");
  const [contentKeyword, setContentKeyword] = useState(business.primaryKeyword ?? "");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMetaTitle, setEditMetaTitle] = useState("");
  const [editMetaDescription, setEditMetaDescription] = useState("");
  const [editBody, setEditBody] = useState("");

  async function call(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/seo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Something went wrong");
      router.refresh();
      return data as Record<string, unknown>;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
    } catch {
      setError("Your browser blocked clipboard access. Select the text and copy it manually.");
    }
  }

  function splitList(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function startEditing(content: Content) {
    setEditingId(content.id);
    setEditTitle(content.title);
    setEditMetaTitle(content.metaTitle ?? "");
    setEditMetaDescription(content.metaDescription ?? "");
    setEditBody(content.body);
  }

  const overview = (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-[0.8fr_1.2fr] sm:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Local SEO score
            </p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-5xl font-bold leading-none">{audit.score}</span>
              <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
              <Badge tone={scoreTone(audit.score)} className="mb-1.5 ml-1">
                {audit.band}
              </Badge>
            </div>
            <Progress value={audit.score} className="mt-3 max-w-xs" />
            <p className="mt-2 text-xs text-muted-foreground">
              Maps readiness {mapsReadiness}% · {audit.actions.length} prioritised actions
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => call({ action: "refresh_audit" }, "audit")}
              disabled={busy === "audit"}
            >
              {busy === "audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh audit
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {audit.sections.map((section) => (
              <div key={section.id} className="rounded-xl bg-muted/60 p-3">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </p>
                  <span className="text-[10px] font-bold tabular-nums">
                    {section.score}/{section.max}
                  </span>
                </div>
                <Progress value={(section.score / section.max) * 100} className="mt-2 h-1.5" />
                <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {section.detail}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fix these first</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.actions.length === 0 && (
            <p className="rounded-xl bg-secondary/50 px-3 py-6 text-center text-sm text-muted-foreground">
              Your core local SEO checks are in good shape. Keep posting and collecting reviews.
            </p>
          )}
          {audit.actions.map((action) => (
            <div key={`${action.area}-${action.title}`} className="rounded-xl border px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Badge
                  tone={action.impact === "high" ? "danger" : action.impact === "medium" ? "warning" : "muted"}
                  className="mt-0.5 shrink-0"
                >
                  {action.impact}
                </Badge>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold">{action.title}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {action.area}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{action.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        This score uses your GrowBuff profile and content, not live Google ranking data. Keyword demand,
        difficulty and priority are directional estimates to help you choose what to write.
      </div>
    </div>
  );

  const keywordPanel = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Local keyword opportunities</h2>
          <p className="text-xs text-muted-foreground">
            Focus on terms you can realistically serve. Confirm real volume in Google Search Console or Keyword Planner.
          </p>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            const result = await call({ action: "generate_keywords" }, "keywords");
            if (result) setNotice("Fresh keyword opportunities generated.");
          }}
          disabled={busy === "keywords"}
        >
          {busy === "keywords" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Find opportunities
        </Button>
      </div>

      <div className="grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-[1fr_150px_auto]">
        <Input
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="Add a keyword, e.g. dentist in Indiranagar"
          aria-label="Keyword"
        />
        <Select value={keywordIntent} onChange={(event) => setKeywordIntent(event.target.value)} aria-label="Intent">
          <option value="local">Local</option>
          <option value="transactional">Transactional</option>
          <option value="commercial">Commercial</option>
          <option value="informational">Informational</option>
        </Select>
        <Button
          variant="outline"
          onClick={async () => {
            if (!keywordInput.trim()) return;
            const result = await call({ action: "add_keyword", keyword: keywordInput, intent: keywordIntent }, "add-keyword");
            if (result) {
              setKeywordInput("");
              setNotice("Keyword added to your tracked set.");
            }
          }}
          disabled={busy === "add-keyword" || !keywordInput.trim()}
        >
          {busy === "add-keyword" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Track
        </Button>
      </div>

      {keywords.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-10 text-center">
          <Search className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">No keywords yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Generate a focused set from your category, city and services. Then track the five that matter most.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keywords.map((keyword) => (
            <div key={keyword.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{keyword.keyword}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone="muted">{keyword.intent}</Badge>
                    <Badge tone={coverageTone(keyword.coverage)}>{keyword.coverage}</Badge>
                    {keyword.source === "manual" && <Badge tone="info">manual</Badge>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={keyword.tracked ? "secondary" : "outline"}
                  onClick={() => call({ action: "toggle_keyword", keywordId: keyword.id }, `keyword-${keyword.id}`)}
                  disabled={busy === `keyword-${keyword.id}`}
                >
                  {busy === `keyword-${keyword.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : keyword.tracked ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Target className="h-3.5 w-3.5" />
                  )}
                  {keyword.tracked ? "Tracking" : "Track"}
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <MiniMetric label="Demand" value={keyword.demand} />
                <MiniMetric label="Difficulty" value={keyword.difficulty} />
                <MiniMetric label="Priority" value={keyword.priority} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Coverage means the terms already appear across your description, services, FAQs, posts or approved
        content. It is not a live ranking position.
      </p>
    </div>
  );

  const contentPanel = (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Content studio</CardTitle>
          <p className="text-xs text-muted-foreground">
            Generate a draft, edit it, then approve it for your team to publish. Nothing is published automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="seo-content-type">Asset type</Label>
              <Select
                id="seo-content-type"
                value={contentType}
                onChange={(event) => setContentType(event.target.value)}
              >
                {CONTENT_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="seo-content-keyword">Target keyword</Label>
              <Input
                id="seo-content-keyword"
                value={contentKeyword}
                onChange={(event) => setContentKeyword(event.target.value)}
                placeholder={business.primaryKeyword ?? `${business.category.toLowerCase()} in ${business.city}`}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="seo-content-notes">Anything we should include?</Label>
            <Textarea
              id="seo-content-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Weekend appointments, free parking, family plan..."
            />
          </div>
          <Button
            onClick={async () => {
              const result = await call(
                {
                  action: "generate_content",
                  type: contentType,
                  keyword: contentKeyword,
                  notes,
                },
                "content"
              );
              if (result) {
                setNotes("");
                setNotice("Draft ready. Review, edit and approve it below.");
              }
            }}
            disabled={busy === "content"}
          >
            {busy === "content" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Draft with AI
          </Button>
        </CardContent>
      </Card>

      {contents.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-10 text-center">
          <FileText className="mx-auto h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">No SEO drafts yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Start with a page title and meta description, then add a service page for your highest-priority keyword.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {contents.map((content) => {
            const isEditing = editingId === content.id;
            const copyValue = [
              content.title,
              content.metaTitle ? `Meta title: ${content.metaTitle}` : "",
              content.metaDescription ? `Meta description: ${content.metaDescription}` : "",
              content.body,
            ]
              .filter(Boolean)
              .join("\n\n");
            return (
              <Card key={content.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{content.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="info">{CONTENT_LABELS[content.type] ?? content.type}</Badge>
                        <Badge tone={content.status === "approved" ? "success" : "warning"}>{content.status}</Badge>
                        <span className="text-[10px] text-muted-foreground">{content.keyword}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => copyText(copyValue, content.id)}>
                        {copied === content.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === content.id ? "Copied" : "Copy"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEditing(content)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {content.status !== "approved" && (
                        <Button
                          size="sm"
                          onClick={() => call({ action: "approve_content", contentId: content.id }, `approve-${content.id}`)}
                          disabled={busy === `approve-${content.id}`}
                        >
                          {busy === `approve-${content.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>

                  {content.metaTitle && (
                    <div className="grid gap-2 rounded-xl bg-muted/50 p-3 text-xs sm:grid-cols-2">
                      <div>
                        <p className="font-bold uppercase tracking-wide text-muted-foreground">Meta title</p>
                        <p className="mt-0.5">{content.metaTitle}</p>
                      </div>
                      <div>
                        <p className="font-bold uppercase tracking-wide text-muted-foreground">Meta description</p>
                        <p className="mt-0.5">{content.metaDescription || "—"}</p>
                      </div>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-3 rounded-xl border p-3">
                      <div>
                        <Label htmlFor={`edit-title-${content.id}`}>Title</Label>
                        <Input
                          id={`edit-title-${content.id}`}
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={`edit-meta-title-${content.id}`}>Meta title</Label>
                          <Input
                            id={`edit-meta-title-${content.id}`}
                            value={editMetaTitle}
                            maxLength={60}
                            onChange={(event) => setEditMetaTitle(event.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-meta-description-${content.id}`}>Meta description</Label>
                          <Input
                            id={`edit-meta-description-${content.id}`}
                            value={editMetaDescription}
                            maxLength={160}
                            onChange={(event) => setEditMetaDescription(event.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`edit-body-${content.id}`}>Content</Label>
                        <Textarea
                          id={`edit-body-${content.id}`}
                          value={editBody}
                          className="min-h-[220px] font-mono text-xs"
                          onChange={(event) => setEditBody(event.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            const result = await call(
                              {
                                action: "update_content",
                                contentId: content.id,
                                title: editTitle,
                                metaTitle: editMetaTitle,
                                metaDescription: editMetaDescription,
                                body: editBody,
                              },
                              `save-${content.id}`
                            );
                            if (result) {
                              setEditingId(null);
                              setNotice("Draft updated.");
                            }
                          }}
                          disabled={busy === `save-${content.id}`}
                        >
                          {busy === `save-${content.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Save changes
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/30 p-3 font-sans text-xs leading-relaxed text-muted-foreground">
                      {content.body}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const mapsPanel = (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Maps focus</CardTitle>
            <p className="text-xs text-muted-foreground">
              These fields feed the score, keyword suggestions and content briefs.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="seo-primary">Primary local keyword</Label>
              <Input
                id="seo-primary"
                value={primaryKeyword}
                onChange={(event) => setPrimaryKeyword(event.target.value)}
                placeholder={`${business.category.toLowerCase()} in ${business.city}`}
              />
            </div>
            <div>
              <Label htmlFor="seo-areas">Service areas</Label>
              <Input
                id="seo-areas"
                value={areas}
                onChange={(event) => setAreas(event.target.value)}
                placeholder="Indiranagar, Domlur, Koramangala"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Separate neighbourhoods with commas.</p>
            </div>
            <div>
              <Label htmlFor="seo-categories">Secondary Google categories</Label>
              <Input
                id="seo-categories"
                value={categories}
                onChange={(event) => setCategories(event.target.value)}
                placeholder="Dental clinic, Teeth whitening service"
              />
            </div>
            <Button
              onClick={async () => {
                const result = await call(
                  {
                    action: "save_settings",
                    primaryKeyword,
                    serviceAreas: splitList(areas),
                    secondaryCategories: splitList(categories),
                  },
                  "settings"
                );
                if (result) setNotice("Maps focus saved. Refresh the audit to update the score.");
              }}
              disabled={busy === "settings"}
            >
              {busy === "settings" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Maps focus
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Maps readiness</CardTitle>
              <Badge tone={scoreTone(mapsReadiness)}>{mapsReadiness}%</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {mapsChecks.filter((check) => check.passed).length} of {mapsChecks.length} checks complete
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={mapsReadiness} />
            <div className="grid gap-1.5 sm:grid-cols-2">
              {mapsChecks.map((check) => (
                <div key={check.label} className="flex items-start gap-2 rounded-lg border px-2.5 py-2">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      check.passed ? "bg-lime/50 text-ink" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {check.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{check.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>How you appear in local results</CardTitle>
              <MapPinned className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <MapPin className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-bold">{business.name}</p>
                  <p className="text-xs text-muted-foreground">{business.category}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
                    <Star className="h-3 w-3 fill-current" />
                    {averageRating.toFixed(1)}
                    <span className="font-normal text-muted-foreground">({reviewCount} reviews)</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{business.address || `${business.city}`}</p>
                  <p className="text-xs font-semibold text-emerald-700">Open {openDays} days a week</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {business.serviceAreas.length > 0 ? (
                  business.serviceAreas.slice(0, 5).map((area) => (
                    <span key={area} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {area}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground">Add service areas to improve this view.</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-primary">
                <span className="flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" /> Website</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Directions</span>
                {business.phone && <span className="flex items-center gap-1"><Search className="h-3.5 w-3.5" /> Call</span>}
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Preview only. Google controls the final local pack layout and ranking. Keep the name, category,
              address, phone, hours and services identical across Google, your website and social profiles.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Copy your NAP record</CardTitle>
            <p className="text-xs text-muted-foreground">
              Use the exact same name, address and phone on citations and directories.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 font-sans text-xs leading-relaxed">
              {[
                business.name,
                business.address || business.city,
                business.phone || "Phone not set",
                business.website || "Website not set",
              ].join("\n")}
            </pre>
            <Button
              variant="outline"
              onClick={() =>
                copyText(
                  [business.name, business.address || business.city, business.phone || "", business.website || ""]
                    .filter(Boolean)
                    .join("\n"),
                  "nap"
                )
              }
            >
              {copied === "nap" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "nap" ? "Copied NAP" : "Copy NAP"}
            </Button>
            <Link
              href="/gbp"
              className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" /> Manage posts and reviews
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Recently published: {recentPosts} post{recentPosts === 1 ? "" : "s"} in the last 30 days.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div>
      {(error || notice) && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-xs font-medium ${
            error ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {error ?? notice}
        </div>
      )}
      <Tabs
        tabs={[
          { id: "overview", label: "Overview", content: overview },
          { id: "keywords", label: "Keywords", badge: keywords.filter((keyword) => keyword.tracked).length || undefined, content: keywordPanel },
          { id: "content", label: "Content", badge: contents.filter((item) => item.status !== "approved").length || undefined, content: contentPanel },
          { id: "maps", label: "Google Maps", content: mapsPanel },
        ]}
      />
    </div>
  );
}
