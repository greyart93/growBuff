"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageSquareReply, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";

type Post = {
  id: string;
  title: string;
  body: string;
  status: string;
  type: string;
  keywords: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
};

type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  status: string;
  reply: string | null;
  sentiment: string;
  reviewedAt: string;
};

export function GbpPanels({
  posts,
  reviews,
  autoReply,
}: {
  posts: Post[];
  reviews: Review[];
  autoReply: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("update");
  const [auto, setAuto] = useState(autoReply);
  const [error, setError] = useState<string | null>(null);

  async function call(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/gbp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Something went wrong");
      router.refresh();
      return data;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleAuto(next: boolean) {
    setAuto(next);
    await call({ action: "toggle_auto_reply", enabled: next }, "auto");
  }

  const pendingPosts = posts.filter((post) => post.status !== "published");
  const pendingReviews = reviews.filter((review) => review.status === "needs_approval" || review.status === "new");

  return (
    <div>
      <Tabs
        tabs={[
          {
            id: "posts",
            label: "Posts",
            badge: pendingPosts.filter((p) => p.status === "pending_approval").length || undefined,
            content: (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">Weekly local posts keep the profile active.</p>
                  <Button size="sm" onClick={() => setModalOpen(true)}>
                    <Wand2 className="h-4 w-4" /> Draft with AI
                  </Button>
                </div>
                {error && <p className="text-xs font-medium text-destructive">{error}</p>}
                {posts.length === 0 && (
                  <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                    No posts yet — generate your first one.
                  </p>
                )}
                {posts.map((post) => (
                  <div key={post.id} className="rounded-2xl border bg-card p-4">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{post.title}</p>
                      <Badge
                        tone={
                          post.status === "published"
                            ? "success"
                            : post.status === "pending_approval"
                              ? "warning"
                              : post.status === "scheduled"
                                ? "info"
                                : "muted"
                        }
                      >
                        {post.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{post.body}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {post.keywords.slice(0, 4).map((keyword) => (
                        <span key={keyword} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {keyword}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {post.status !== "published" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => call({ action: "post_action", postId: post.id, mode: "publish" }, post.id)}
                            disabled={busy === post.id}
                          >
                            {busy === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Approve & publish
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => call({ action: "post_action", postId: post.id, mode: "schedule" }, `${post.id}-s`)}
                            disabled={busy === `${post.id}-s`}
                          >
                            Schedule
                          </Button>
                        </>
                      )}
                      {post.publishedAt && (
                        <span className="text-[11px] text-muted-foreground">
                          Published {formatDate(post.publishedAt)}
                        </span>
                      )}
                      {post.scheduledAt && post.status === "scheduled" && (
                        <span className="text-[11px] text-muted-foreground">
                          Scheduled {formatDate(post.scheduledAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            id: "reviews",
            label: "Reviews",
            badge: pendingReviews.length || undefined,
            content: (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">Auto-reply to good reviews</p>
                    <p className="text-xs text-muted-foreground">
                      Negative and 3★ reviews always wait for your approval.
                    </p>
                  </div>
                  <Switch checked={auto} onChange={toggleAuto} label="Auto-reply to reviews" disabled={busy === "auto"} />
                </div>
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{review.author}</p>
                        <p className="text-xs text-amber-600" aria-label={`${review.rating} out of 5 stars`}>
                          {"★".repeat(review.rating)}
                          <span className="text-muted-foreground">{"★".repeat(5 - review.rating)}</span>
                        </p>
                      </div>
                      <Badge
                        tone={
                          review.status === "replied"
                            ? "success"
                            : review.status === "needs_approval"
                              ? "warning"
                              : "muted"
                        }
                      >
                        {review.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{review.text}</p>
                    {review.reply && (
                      <div className="mt-2 rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Draft reply</p>
                        {review.reply}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {review.status !== "replied" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => call({ action: "draft_reply", reviewId: review.id }, review.id)}
                          disabled={busy === review.id}
                        >
                          {busy === review.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {review.reply ? "Redraft" : "Draft reply"}
                        </Button>
                      )}
                      {review.status === "needs_approval" && review.reply && (
                        <Button
                          size="sm"
                          onClick={() => call({ action: "approve_reply", reviewId: review.id }, `${review.id}-ok`)}
                          disabled={busy === `${review.id}-ok`}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve & post
                        </Button>
                      )}
                      {review.status === "replied" && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                          <MessageSquareReply className="h-3.5 w-3.5" /> Replied
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Draft a Google post">
        <div className="space-y-4">
          <div>
            <Label htmlFor="post-topic">What should it be about?</Label>
            <Input
              id="post-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Weekend dental check-up slots"
            />
          </div>
          <div>
            <Label htmlFor="post-type">Type</Label>
            <select
              id="post-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-12 w-full rounded-xl border bg-card px-3.5 text-base"
            >
              <option value="update">Update</option>
              <option value="offer">Offer</option>
              <option value="event">Event</option>
              <option value="photo">Photo caption</option>
            </select>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={busy === "generate"}
            onClick={async () => {
              const result = await call({ action: "generate_post", topic, type }, "generate");
              if (result) {
                setModalOpen(false);
                setTopic("");
              }
            }}
          >
            {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Draft for approval
          </Button>
          <p className="text-xs text-muted-foreground">
            Nothing is published until you approve it. Posts stay on-brand and use local keywords.
          </p>
        </div>
      </Modal>
    </div>
  );
}
