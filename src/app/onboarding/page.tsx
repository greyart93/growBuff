"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

type Service = { name: string; priceRupees: string; durationMin: string };
type Faq = { q: string; a: string };

const steps = ["Business", "Hours & services", "Brand & FAQs", "Connect"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Dentist");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const [weekday, setWeekday] = useState({ open: "10:00", close: "19:00" });
  const [saturday, setSaturday] = useState({ open: "10:00", close: "16:00" });
  const [sundayClosed, setSundayClosed] = useState(true);
  const [services, setServices] = useState<Service[]>([
    { name: "Consultation", priceRupees: "500", durationMin: "30" },
  ]);

  const [tone, setTone] = useState("friendly");
  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [faqs, setFaqs] = useState<Faq[]>([
    { q: "Do you take walk-ins?", a: "Yes, but booking on WhatsApp gets you a confirmed time." },
  ]);

  const [connectGoogle, setConnectGoogle] = useState(true);
  const [connectWhatsapp, setConnectWhatsapp] = useState(true);

  function toggleLanguage(language: string) {
    setLanguages((current) =>
      current.includes(language) ? current.filter((item) => item !== language) : [...current, language]
    );
  }

  function next() {
    setError(null);
    if (step === 0) {
      if (name.trim().length < 2 || city.trim().length < 2) {
        setError("Tell us the business name and city");
        return;
      }
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        category,
        city,
        address,
        phone,
        website,
        description,
        brandTone: tone,
        languages: languages.length ? languages : ["en"],
        hours: {
          mon: { ...weekday },
          tue: { ...weekday },
          wed: { ...weekday },
          thu: { ...weekday },
          fri: { ...weekday },
          sat: { ...saturday },
          sun: { ...weekday, closed: sundayClosed },
        },
        services: services
          .filter((service) => service.name.trim())
          .map((service) => ({
            name: service.name.trim(),
            pricePaise: Math.round(Number(service.priceRupees || 0) * 100),
            durationMin: Number(service.durationMin || 30),
          })),
        faqs: faqs.filter((faq) => faq.q.trim() && faq.a.trim()),
        connectGoogle,
        connectWhatsapp,
      };
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="container flex h-16 items-center justify-between">
        <Brand />
        <span className="text-xs font-semibold text-muted-foreground">
          Step {step + 1} of {steps.length}
        </span>
      </header>

      <div className="container max-w-2xl pb-10">
        <div className="mb-5 flex gap-1.5">
          {steps.map((label, index) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
              />
              <p className="mt-1.5 hidden text-[11px] font-medium text-muted-foreground sm:block">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Tell us about your business</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  This becomes the source of truth for everything your agents say.
                </p>
              </div>
              <div>
                <Label htmlFor="name">Business name</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Smile Care Dental" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="category">Business type</Label>
                  <Select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>
                    {["Dentist", "Clinic", "Salon", "Gym", "Restaurant", "Home services", "Other"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Bengaluru" />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address (used for directions)</Label>
                <Input id="address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="12th Main, Indiranagar" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Business WhatsApp number</Label>
                  <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
                </div>
                <div>
                  <Label htmlFor="website">Website (optional)</Label>
                  <Input id="website" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" />
                </div>
              </div>
              <div>
                <Label htmlFor="description">What should customers know about you?</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Family dental clinic in Indiranagar. Gentle care, evening slots, English and Hindi."
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold tracking-tight">When are you open?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  The chat agent only offers slots inside these hours.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Monday to Friday</Label>
                  <div className="flex items-center gap-2">
                    <Input type="time" value={weekday.open} onChange={(event) => setWeekday({ ...weekday, open: event.target.value })} />
                    <span className="text-muted-foreground">to</span>
                    <Input type="time" value={weekday.close} onChange={(event) => setWeekday({ ...weekday, close: event.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Saturday</Label>
                  <div className="flex items-center gap-2">
                    <Input type="time" value={saturday.open} onChange={(event) => setSaturday({ ...saturday, open: event.target.value })} />
                    <span className="text-muted-foreground">to</span>
                    <Input type="time" value={saturday.close} onChange={(event) => setSaturday({ ...saturday, close: event.target.value })} />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sundayClosed}
                  onChange={(event) => setSundayClosed(event.target.checked)}
                  className="h-5 w-5 rounded border-input accent-emerald-600"
                />
                Closed on Sunday
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="mb-0">Services & prices</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setServices([...services, { name: "", priceRupees: "", durationMin: "30" }])}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {services.map((service, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_32px] gap-2 sm:grid-cols-[1fr_82px_72px_32px]">
                      <Input
                        aria-label="Service name"
                        className="col-span-2 sm:col-span-1"
                        value={service.name}
                        placeholder="Teeth whitening"
                        onChange={(event) => {
                          const copy = [...services];
                          copy[index] = { ...service, name: event.target.value };
                          setServices(copy);
                        }}
                      />
                      <Input
                        aria-label="Price in rupees"
                        className="row-start-2 sm:row-start-auto"
                        inputMode="numeric"
                        value={service.priceRupees}
                        placeholder="₹"
                        onChange={(event) => {
                          const copy = [...services];
                          copy[index] = { ...service, priceRupees: event.target.value.replace(/\D/g, "") };
                          setServices(copy);
                        }}
                      />
                      <Input
                        aria-label="Duration in minutes"
                        className="row-start-2 sm:row-start-auto"
                        inputMode="numeric"
                        value={service.durationMin}
                        placeholder="min"
                        onChange={(event) => {
                          const copy = [...services];
                          copy[index] = { ...service, durationMin: event.target.value.replace(/\D/g, "") };
                          setServices(copy);
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Remove service"
                        onClick={() => setServices(services.filter((_, i) => i !== index))}
                        className="col-start-3 row-start-1 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted sm:col-start-auto sm:row-start-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Price in ₹, duration in minutes.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Your voice, and the questions you get every day</h1>
                <p className="mt-1 text-sm text-muted-foreground">The agents copy this tone and answer only from these facts.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tone">Brand tone</Label>
                  <Select id="tone" value={tone} onChange={(event) => setTone(event.target.value)}>
                    <option value="friendly">Friendly & warm</option>
                    <option value="professional">Professional</option>
                    <option value="playful">Playful</option>
                    <option value="premium">Calm & premium</option>
                  </Select>
                </div>
                <div>
                  <Label>Languages</Label>
                  <div className="flex gap-2">
                    {[
                      { code: "en", label: "English" },
                      { code: "hi", label: "हिन्दी" },
                    ].map((language) => (
                      <button
                        key={language.code}
                        type="button"
                        onClick={() => toggleLanguage(language.code)}
                        className={`flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold ${
                          languages.includes(language.code)
                            ? "border-primary bg-secondary text-primary"
                            : "bg-card text-muted-foreground"
                        }`}
                      >
                        {languages.includes(language.code) && <Check className="h-4 w-4" />}
                        {language.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="mb-0">FAQs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFaqs([...faqs, { q: "", a: "" }])}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <div key={index} className="rounded-xl border p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Input
                          aria-label="FAQ question"
                          value={faq.q}
                          placeholder="Do you take walk-ins?"
                          onChange={(event) => {
                            const copy = [...faqs];
                            copy[index] = { ...faq, q: event.target.value };
                            setFaqs(copy);
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Remove FAQ"
                          onClick={() => setFaqs(faqs.filter((_, i) => i !== index))}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <Textarea
                        aria-label="FAQ answer"
                        value={faq.a}
                        placeholder="Answer in one or two sentences"
                        className="min-h-[70px]"
                        onChange={(event) => {
                          const copy = [...faqs];
                          copy[index] = { ...faq, a: event.target.value };
                          setFaqs(copy);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Connect your accounts</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sandbox mode: connections work locally, no Google or Meta approval needed.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConnectGoogle(!connectGoogle)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${
                  connectGoogle ? "border-primary bg-secondary/40" : "bg-card"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-bold text-[#4285F4] shadow-sm">
                  G
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">Google Business Profile</span>
                  <span className="block text-xs text-muted-foreground">Reviews, posts, calls & directions</span>
                </span>
                {connectGoogle ? <Check className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
              </button>

              <button
                type="button"
                onClick={() => setConnectWhatsapp(!connectWhatsapp)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left ${
                  connectWhatsapp ? "border-primary bg-secondary/40" : "bg-card"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1a12 12 0 0 1-5.9-5.2c-.4-.7-.8-1.5-.5-2.2.2-.5.7-1 1-1.2.2-.1.5-.1.7 0l.8 1.4c.1.2 0 .4-.1.6l-.4.5c-.1.2-.2.3 0 .6.5.8 1.3 1.6 2.2 2 .3.1.4.1.6-.1l.5-.6c.2-.2.4-.2.6-.1l1.5.7c.2.1.3.3.3.5 0 .2 0 .8-.1 1.1Z" />
                  </svg>
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">WhatsApp Business</span>
                  <span className="block text-xs text-muted-foreground">Chat agent, campaigns, templates</span>
                </span>
                {connectWhatsapp ? <Check className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
              </button>

              <div className="rounded-xl bg-secondary/60 p-3.5 text-sm">
                <p className="flex items-center gap-2 font-semibold text-primary">
                  <Sparkles className="h-4 w-4" /> On finish
                </p>
                <p className="mt-1 text-muted-foreground">
                  We&apos;ll build your knowledge base from these answers. The chat agent will only answer
                  from it — and call you when it isn&apos;t sure.
                </p>
              </div>
            </div>
          )}

          <FieldError>{error}</FieldError>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" size="lg" onClick={next}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={finish} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Build my agents
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge tone="muted">English + हिन्दी</Badge>
          <Badge tone="muted">Approval-first</Badge>
          <Badge tone="muted">Sandbox integrations</Badge>
        </div>
      </div>
    </div>
  );
}
