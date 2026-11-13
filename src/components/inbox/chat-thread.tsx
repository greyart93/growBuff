"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send, Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  direction: string;
  role: string;
  body: string;
  status?: string;
  error?: string | null;
  createdAt: string;
  groundedSources?: string[];
};

export function ChatThread({
  conversationId,
  contactName,
  phone,
  aiPaused,
  handoffReason,
  locale,
  windowExpiresAt,
  initialMessages,
}: {
  conversationId: string;
  contactName: string;
  phone: string;
  aiPaused: boolean;
  handoffReason: string | null;
  locale: string;
  windowExpiresAt: string | null;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [paused, setPaused] = useState(aiPaused);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const windowOpen = Boolean(windowExpiresAt && new Date(windowExpiresAt).getTime() > Date.now());
  const ownerLocked = paused && !windowOpen;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function toggleAi(next: boolean) {
    setPaused(next);
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aiPaused: next }),
    });
  }

  async function sendOwner(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const body = text.trim();
    setText("");
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send");
      setMessages((current) => [...current, data.message]);
      setPaused(true);
    } catch (err) {
      setError((err as Error).message);
      setText(body);
    } finally {
      setBusy(false);
    }
  }

  async function simulate(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const body = text.trim();
    setText("");
    try {
      const response = await fetch(`/api/conversations/${conversationId}/simulate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not simulate");
      setMessages((current) => [...current, ...data.messages]);
      if (data.handoff) setPaused(true);
    } catch (err) {
      setError((err as Error).message);
      setText(body);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/inbox" className="rounded-full p-2 hover:bg-muted" aria-label="Back to inbox">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex -space-x-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
            {contactName.slice(0, 1)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{contactName}</p>
          <p className="truncate text-xs text-muted-foreground">{phone}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-card px-2.5 py-1">
          <span className="text-[10px] font-semibold text-muted-foreground">
            {paused ? (locale === "hi" ? "AI बंद" : "AI off") : locale === "hi" ? "AI चालू" : "AI on"}
          </span>
          <Switch checked={!paused} onChange={(next) => toggleAi(!next)} label="AI replies" />
        </div>
      </div>

      {handoffReason && paused && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Handed to you:</span> {handoffReason}
        </div>
      )}

      {paused && !windowOpen && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <span className="font-semibold">24-hour window closed.</span> Free-form replies cannot be delivered.
          Wait for the customer to message again, or send an approved template from Campaigns.
        </div>
      )}

      <div className="chat-canvas flex min-h-[52vh] flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border p-3">
        {messages.map((message) => {
          const outbound = message.direction === "out";
          return (
            <div
              key={message.id}
              className={cn("max-w-[86%] rounded-xl px-3 py-2 text-[13.5px] leading-relaxed shadow-sm", outbound ? "self-end rounded-tr-sm bg-wa-bubble" : "self-start rounded-tl-sm bg-white")}
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                {message.role === "ai" && <Sparkles className="h-3 w-3 text-emerald-700" />}
                {message.role === "agent" && <UserRound className="h-3 w-3 text-sky-700" />}
                {outbound && message.status && (
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      message.status === "failed" ? "text-rose-600" : "text-black/45"
                    )}
                    title={message.error ?? `WhatsApp: ${message.status}`}
                  >
                    {message.status === "failed"
                      ? "Failed"
                      : message.status === "read" || message.status === "delivered"
                        ? "✓✓"
                        : message.status === "sent"
                          ? "✓"
                          : message.status}
                  </span>
                )}
                <span className="text-[10px] text-black/40">
                  {new Date(message.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              {message.role === "ai" && message.groundedSources && message.groundedSources.length > 0 && (
                <p className="mt-1 border-t border-black/10 pt-1 text-[10px] text-black/45">
                  Source: {[...new Set(message.groundedSources)].join(", ")}
                </p>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form onSubmit={paused ? sendOwner : simulate} className="sticky bottom-20 mt-3 lg:bottom-4">
        <div className="rounded-2xl border bg-card p-2 shadow-soft">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {paused ? (
              <Badge tone="info">Replying as you · AI paused</Badge>
            ) : (
              <Badge tone="success">AI is replying</Badge>
            )}
            <button
              type="button"
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground disabled:opacity-50"
              disabled={ownerLocked}
              onClick={() => setText("Thank you for your patience. How can we help?")}
            >
              Quick reply
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                ownerLocked
                  ? "Window closed — use an approved template"
                  : paused
                    ? "Type your reply…"
                    : "Simulate a customer message…"
              }
              aria-label="Message"
              disabled={ownerLocked}
              className="border-0 bg-transparent focus-visible:ring-0"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  (event.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full"
              disabled={busy || !text.trim() || ownerLocked}
              aria-label="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {error && <p className="px-1 pt-1 text-xs font-medium text-destructive">{error}</p>}
          <p className="px-1 pt-1 text-[10px] text-muted-foreground">
            {ownerLocked
              ? "WhatsApp allows free-form replies for 24 hours after the customer's last message."
              : paused
                ? "You are replying, so the AI stays paused for this chat."
                : "Sandbox: your message arrives as if the customer sent it, then the agent replies."}
          </p>
        </div>
      </form>
    </div>
  );
}
