"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

type Segment = { all?: boolean; tags?: string[]; inactiveDays?: number; birthdayMonth?: boolean };

export function CampaignComposer({
  small,
  preset,
}: {
  small?: boolean;
  preset?: { goal: string; name: string; segment: Segment; brief?: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState(preset?.goal ?? "win_back");
  const [audience, setAudience] = useState(
    preset?.segment.inactiveDays ? "inactive" : preset?.segment.birthdayMonth ? "birthday" : preset?.segment.tags ? "tag" : "all"
  );
  const [tag, setTag] = useState(preset?.segment.tags?.[0] ?? "price-enquiry");
  const [name, setName] = useState(preset?.name ?? "");
  const [brief, setBrief] = useState(preset?.brief ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const segment: Segment =
        audience === "inactive"
          ? { inactiveDays: 60 }
          : audience === "birthday"
            ? { birthdayMonth: true }
            : audience === "tag"
              ? { tags: [tag] }
              : { all: true };
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", goal, name, brief, segment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not draft campaign");
      router.push(`/campaigns/${data.campaignId}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      {small ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-primary"
        >
          <Wand2 className="h-3.5 w-3.5" /> Draft this
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Wand2 className="h-4 w-4" /> New campaign
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Draft a campaign">
        <form onSubmit={create} className="space-y-4">
          <div>
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Diwali fresh-smile offer"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="campaign-goal">Goal</Label>
              <Select id="campaign-goal" value={goal} onChange={(event) => setGoal(event.target.value)}>
                <option value="win_back">Win back quiet customers</option>
                <option value="festival">Festival wishes</option>
                <option value="birthday">Birthday offer</option>
                <option value="reactivation">Follow up on enquiries</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="campaign-audience">Audience</Label>
              <Select id="campaign-audience" value={audience} onChange={(event) => setAudience(event.target.value)}>
                <option value="all">All opted-in customers</option>
                <option value="inactive">Not seen in 60 days</option>
                <option value="birthday">Birthday this month</option>
                <option value="tag">Tag</option>
              </Select>
            </div>
          </div>
          {audience === "tag" && (
            <div>
              <Label htmlFor="campaign-tag">Tag</Label>
              <Input id="campaign-tag" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="price-enquiry" />
            </div>
          )}
          <div>
            <Label htmlFor="campaign-brief">Any detail to include? (optional)</Label>
            <Textarea
              id="campaign-brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Mention the family plan, no discounts"
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Draft campaign (needs approval)
          </Button>
          <p className="text-xs text-muted-foreground">
            Only opted-in contacts are included. You review the copy and template before anything sends.
          </p>
        </form>
      </Modal>
    </>
  );
}
