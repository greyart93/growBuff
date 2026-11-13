"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { BusinessHours, Service } from "@/lib/types";

type Business = {
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  website: string;
  description: string;
  brandTone: string;
  languages: string[];
  autoReplyReviews: boolean;
  hours: BusinessHours;
  services: Service[];
  faqCount: number;
};

export function SettingsForm({ business }: { business: Business | null }) {
  const router = useRouter();
  const [form, setForm] = useState(business);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!form) return <p className="text-sm text-muted-foreground">Complete onboarding first.</p>;

  const set = <K extends keyof Business>(key: K, value: Business[K]) =>
    setForm({ ...form, [key]: value });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save");
      setMessage("Saved. Your agents use these facts from the next message.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="s-name">Business name</Label>
          <Input id="s-name" value={form.name} onChange={(event) => set("name", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-city">City</Label>
          <Input id="s-city" value={form.city} onChange={(event) => set("city", event.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="s-category">Category</Label>
          <Input id="s-category" value={form.category} onChange={(event) => set("category", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-phone">Business phone</Label>
          <Input id="s-phone" value={form.phone} onChange={(event) => set("phone", event.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="s-address">Address</Label>
        <Input id="s-address" value={form.address} onChange={(event) => set("address", event.target.value)} />
      </div>
      <div>
        <Label htmlFor="s-website">Website</Label>
        <Input id="s-website" value={form.website} onChange={(event) => set("website", event.target.value)} />
      </div>
      <div>
        <Label htmlFor="s-description">Description</Label>
        <Textarea
          id="s-description"
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="s-tone">Brand tone</Label>
          <Select id="s-tone" value={form.brandTone} onChange={(event) => set("brandTone", event.target.value)}>
            <option value="friendly">Friendly & warm</option>
            <option value="professional">Professional</option>
            <option value="playful">Playful</option>
            <option value="premium">Calm & premium</option>
          </Select>
        </div>
        <div>
          <Label>Languages</Label>
          <div className="flex gap-2">
            {["en", "hi"].map((language) => {
              const active = form.languages.includes(language);
              return (
                <button
                  key={language}
                  type="button"
                  onClick={() =>
                    set(
                      "languages",
                      active
                        ? form.languages.filter((item) => item !== language)
                        : [...form.languages, language]
                    )
                  }
                  className={`h-12 flex-1 rounded-xl border text-sm font-semibold ${
                    active ? "border-primary bg-secondary text-primary" : "bg-card text-muted-foreground"
                  }`}
                >
                  {language === "en" ? "English" : "हिन्दी"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <Label>Opening hours</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {weekdays.map((day) => {
            const config = form.hours[day] ?? { open: "10:00", close: "19:00" };
            return (
              <div key={day} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                <span className="w-9 text-xs font-semibold uppercase text-muted-foreground">{day}</span>
                <input
                  type="time"
                  value={config.open}
                  aria-label={`${day} opening`}
                  onChange={(event) =>
                    set("hours", { ...form.hours, [day]: { ...config, open: event.target.value } })
                  }
                  className="min-w-0 flex-1 rounded-lg border px-1.5 py-1 text-xs"
                />
                <input
                  type="time"
                  value={config.close}
                  aria-label={`${day} closing`}
                  onChange={(event) =>
                    set("hours", { ...form.hours, [day]: { ...config, close: event.target.value } })
                  }
                  className="min-w-0 flex-1 rounded-lg border px-1.5 py-1 text-xs"
                />
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(config.closed)}
                    onChange={(event) =>
                      set("hours", {
                        ...form.hours,
                        [day]: { ...config, closed: event.target.checked },
                      })
                    }
                    className="h-3.5 w-3.5 accent-emerald-600"
                  />
                  closed
                </label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Auto-reply to good reviews</p>
          <p className="text-xs text-muted-foreground">Negative reviews always need your approval.</p>
        </div>
        <Switch
          checked={form.autoReplyReviews}
          onChange={(next) => set("autoReplyReviews", next)}
          label="Auto-reply to good reviews"
        />
      </div>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save settings
      </Button>
    </form>
  );
}
