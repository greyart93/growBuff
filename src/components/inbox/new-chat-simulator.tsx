"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

export function NewChatSimulator() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Hi, how much is a teeth cleaning?");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start chat");
      setOpen(false);
      router.push(`/inbox/${data.conversationId}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">New test chat</span>
        <span className="sm:hidden">Test</span>
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Simulate a customer message">
        <form onSubmit={send} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sandbox mode: this acts like a customer messaging your WhatsApp number. The AI agent replies
            instantly using your knowledge base.
          </p>
          <div>
            <Label htmlFor="customer-name">Customer name</Label>
            <Input
              id="customer-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Neha Sharma"
            />
          </div>
          <div>
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+919811122233"
            />
          </div>
          <div>
            <Label htmlFor="customer-message">Message</Label>
            <Input
              id="customer-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Hi, do you have a slot on Saturday?"
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" size="lg" disabled={loading || !message.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
            Send as customer
          </Button>
        </form>
      </Modal>
    </>
  );
}
