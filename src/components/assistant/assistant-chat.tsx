"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type PendingAction = { runId: string; label: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pendingAction?: PendingAction | null;
  navigate?: string;
};

const suggestions = [
  "How was this week?",
  "Draft a Diwali campaign for last month's customers",
  "Show my hottest leads",
  "Draft a Google post about weekend slots",
];

export function AssistantChat({
  businessName,
  pendingActions,
}: {
  businessName: string;
  pendingActions: PendingAction[];
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Namaste! I'm your growth assistant for ${businessName}. I can draft campaigns, write Google posts, change opening hours or show you what's working. I'll always ask before anything goes public or reaches a customer.`,
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(value: string) {
    const message = value.trim();
    if (!message || busy) return;
    setText("");
    setBusy(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: "user", content: message },
    ]);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Assistant failed");
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          pendingAction: data.pendingAction ?? null,
          navigate: data.navigate,
        },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(runId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmRunId: runId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not confirm");
      setMessages((current) =>
        current.map((message) =>
          message.pendingAction?.runId === runId ? { ...message, pendingAction: null } : message
        )
      );
      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5 text-amber-300" />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Growth Assistant</h1>
          <p className="text-xs text-muted-foreground">Runs your other three agents · asks before acting</p>
        </div>
      </div>

      {pendingActions.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-900">Waiting for your confirmation</p>
          {pendingActions.map((action) => (
            <div key={action.runId} className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-xs capitalize text-amber-900">{action.label}</span>
              <Button size="sm" variant="outline" onClick={() => confirm(action.runId)} disabled={busy}>
                <Check className="h-3.5 w-3.5" /> Confirm
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="min-h-[48vh] space-y-3 rounded-2xl border bg-card p-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              message.role === "user"
                ? "ml-auto rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm bg-muted"
            )}
          >
            {message.content}
            {message.pendingAction && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-card px-2 py-1.5">
                <span className="flex-1 text-xs capitalize text-muted-foreground">
                  {message.pendingAction.label}
                </span>
                <Button size="sm" onClick={() => confirm(message.pendingAction!.runId)} disabled={busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Confirm
                </Button>
              </div>
            )}
            {message.navigate && message.role === "assistant" && (
              <Link
                href={message.navigate}
                className="mt-2 inline-block text-xs font-semibold text-primary underline underline-offset-2"
              >
                Open
              </Link>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working on it…
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => send(suggestion)}
            disabled={busy}
            className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
        className="mt-2 rounded-2xl border bg-card p-2 shadow-soft"
      >
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ask in English or Hindi…"
            aria-label="Message the growth assistant"
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={busy || !text.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="px-1 pt-1 text-xs font-medium text-destructive">{error}</p>}
      </form>

      <p className="mt-2 px-1 text-[11px] text-muted-foreground">
        The assistant never sends or publishes without your explicit confirmation. Every action is logged.
      </p>
    </div>
  );
}
