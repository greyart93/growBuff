import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  CalendarCheck,
  Check,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { PLANS } from "@/lib/usage";
import { formatMoney } from "@/lib/utils";

const agents = [
  {
    number: "01",
    icon: MapPin,
    name: "Google Agent",
    line: "Get found. Get chosen.",
    copy: "Audits your profile, rewrites it with local keywords, posts for you and turns happy customers into 5-star reviews.",
    items: ["Profile score + fix list", "AI posts on autopilot", "Review requests & replies"],
    chip: "bg-gold-soft text-ink",
  },
  {
    number: "02",
    icon: MessageCircle,
    name: "WhatsApp Chat Agent",
    line: "Every enquiry answered.",
    copy: "Replies in English or Hindi from your business facts only, books appointments, scores leads and calls you when a human is needed.",
    items: ["24×7 grounded replies", "Bookings & reminders", "One shared inbox"],
    chip: "bg-gold text-ink",
  },
  {
    number: "03",
    icon: Megaphone,
    name: "WhatsApp Marketing Agent",
    line: "Bring them back.",
    copy: "Spots Diwali, birthdays and quiet customers, writes the campaign in your tone, gets it approved and reports what it earned.",
    items: ["Festival & win-back campaigns", "Template approvals handled", "Reminders, reviews, offers"],
    chip: "bg-clay/20 text-[#a53a20]",
  },
];

const ticker = [
  "Google Business Profile",
  "WhatsApp Chat",
  "Festival Campaigns",
  "Review Requests",
  "Appointment Reminders",
  "English + हिन्दी",
];

const steps = [
  {
    number: "01",
    title: "Tell us about your business",
    copy: "Four short steps. Services, timings, tone and the questions you answer every day.",
  },
  {
    number: "02",
    title: "Your agents learn the facts",
    copy: "We build a private knowledge base. The AI answers only from it — and asks for help when it isn't sure.",
  },
  {
    number: "03",
    title: "Approve once. Grow daily.",
    copy: "Every post, campaign and price change waits for your tap. Everything else runs on its own.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-cream text-ink">
      <div className="fixed inset-x-0 top-3 z-50 px-3">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-white/10 bg-ink/95 px-3 py-2.5 pl-4 shadow-[0_20px_40px_-24px_rgba(10,23,16,0.9)] backdrop-blur-xl sm:px-5">
          <Link href="/" aria-label="GrowBuff home">
            <Brand tone="light" accent="gold" />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="#agents"
              className="hidden rounded-full px-3 py-2 text-xs font-semibold text-cream/60 transition-colors hover:text-cream sm:block"
            >
              Agents
            </Link>
            <Link
              href="#how"
              className="hidden rounded-full px-3 py-2 text-xs font-semibold text-cream/60 transition-colors hover:text-cream sm:block"
            >
              How it works
            </Link>
            <Link
              href="#pricing"
              className="hidden rounded-full px-3 py-2 text-xs font-semibold text-cream/60 transition-colors hover:text-cream sm:block"
            >
              Pricing
            </Link>
            <Link href="/login">
              <Button variant="gold" size="sm" className="h-9 px-4 text-[11px] uppercase tracking-[0.08em]">
                Start free
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </nav>
        </header>
      </div>

      <section className="relative overflow-hidden bg-ink pb-16 pt-28 text-cream sm:pt-32 lg:pb-24 lg:pt-40">
        <div className="aurora absolute inset-0 animate-drift" />
        <div className="grid-lines absolute inset-0" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full border border-goldenrod/30" />
        <div className="absolute -right-10 top-40 h-40 w-40 rounded-full border border-cream/10" />

        <div className="container relative grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] py-1.5 pl-2 pr-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cream/70">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-ink">
                  <Asterisk className="h-3 w-3" />
                </span>
                Built for Indian local businesses
              </div>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 text-[2rem] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[3rem] lg:text-[3.6rem]">
                Your AI
                <br />
                marketing team.
                <br />
                <span className="italic text-gold">On WhatsApp.</span>
              </h1>
            </Reveal>

            <Reveal delay={150}>
              <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-cream/60 sm:text-base">
                GrowBuff answers every customer, gets you found on Google and brings people back — in
                English and Hindi. No marketing skills. No new app to learn.
              </p>
            </Reveal>

            <Reveal delay={220}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/login">
                  <Button variant="gold" size="lg" className="group relative w-full overflow-hidden sm:w-auto">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                    />
                    <span className="relative flex items-center gap-2">
                      Try the demo clinic
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </Button>
                </Link>
                <Link href="#agents">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/20 text-cream hover:border-white/40 hover:bg-white/10 sm:w-auto"
                  >
                    See what the agents do
                  </Button>
                </Link>
              </div>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.1em] text-cream/35">
                Sandbox: 9876543210 · OTP on screen · No card
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 border-t border-white/10 pt-5 text-[12px] text-cream/55">
                {["Works on any phone", "Approve before anything sends", "English + हिन्दी"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-gold" /> {item}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={180} className="relative mx-auto w-full max-w-[380px] lg:mx-0">
            <div className="absolute -inset-10 rounded-full bg-goldenrod/20 blur-3xl" />
            <div className="absolute -inset-4 animate-spin-slow rounded-[3rem] bg-[conic-gradient(from_0deg,transparent,rgba(255,215,0,0.45),transparent_45%)] blur-2xl" />
            <div className="relative animate-float-slow rounded-[2.4rem] border border-white/15 bg-[#0d1f16] p-3 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.9)]">
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1 text-[9px] uppercase tracking-[0.2em] text-cream/35">
                <span>Smile Care Dental</span>
                <span className="flex items-center gap-1.5 text-gold">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
                  </span>
                  live
                </span>
              </div>
              <div className="overflow-hidden rounded-[1.8rem] bg-[#EDF2F8]">
                <div className="flex items-center gap-2.5 bg-[#075E54] px-3.5 py-3 text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold">
                    SC
                  </span>
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold">Smile Care Dental</p>
                    <p className="text-[9px] text-white/60">online · replies instantly</p>
                  </div>
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-ink">
                    AI
                  </span>
                </div>
                <div className="space-y-2 p-3 text-[12px] leading-snug">
                  <div
                    className="bubble-in ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-wa-bubble px-3 py-2 text-ink shadow-sm"
                    style={{ animationDelay: "180ms" }}
                  >
                    Hi, do you have a cleaning slot on Saturday?
                  </div>
                  <div
                    className="bubble-in mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-ink shadow-sm"
                    style={{ animationDelay: "520ms" }}
                  >
                    Happy to book you in! These are open:
                    <br />
                    <strong>1.</strong> Sat, 15 Nov, 10:30 am
                    <br />
                    <strong>2.</strong> Sat, 15 Nov, 12:00 pm
                    <br />
                    <strong>3.</strong> Sat, 15 Nov, 3:00 pm
                  </div>
                  <div
                    className="bubble-in ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-wa-bubble px-3 py-2 text-ink shadow-sm"
                    style={{ animationDelay: "860ms" }}
                  >
                    Option 1 please 🙏
                  </div>
                  <div
                    className="bubble-in mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-ink shadow-sm"
                    style={{ animationDelay: "1200ms" }}
                  >
                    Booked! Sat 10:30 am. We&apos;ll remind you the day before.
                  </div>
                </div>
                <div className="m-2 mt-0 flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] text-ink/35">
                  Type a message…
                  <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </div>

            <div
              className="absolute -left-36 bottom-16 hidden rotate-[-4deg] animate-float rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-lift sm:block"
              style={{ animationDelay: "-3s" }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink/60">Booked overnight</p>
              <p className="mt-0.5 text-sm font-extrabold text-ink">+3 appointments</p>
            </div>
            <div
              className="absolute -right-3 -top-5 hidden rotate-[5deg] animate-float rounded-2xl bg-gold px-4 py-3 text-ink shadow-lift sm:block"
              style={{ animationDelay: "-1.5s" }}
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ink/70">Reply time</p>
              <p className="mt-0.5 text-sm font-extrabold">0.8 seconds</p>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="marquee overflow-hidden border-y border-ink/10 bg-gold py-3.5">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
              {ticker.map((item) => (
                <span
                  key={`${copy}-${item}`}
                  className="flex items-center gap-5 px-6 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink"
                >
                  {item}
                  <Asterisk className="h-3.5 w-3.5 text-ink/50" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="container grid gap-8 py-14 sm:grid-cols-3 sm:py-20">
        {[
          { value: 38, suffix: "%", label: "more calls from Google in 60 days", icon: Phone },
          { value: 24, suffix: "/7", label: "enquiries answered, even at 11 pm", icon: CalendarCheck },
          { value: 11, suffix: "%", label: "typical WhatsApp campaign reply rate", icon: Users },
        ].map((stat, index) => (
          <Reveal key={stat.label} delay={index * 90}>
            <div className="flex items-start gap-4 border-l border-ink/15 pl-5">
              <stat.icon className="mt-1 h-5 w-5 shrink-0 text-primary" strokeWidth={1.6} />
              <div>
                <p className="text-3xl font-bold leading-none tracking-tight sm:text-4xl">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-2 max-w-[190px] text-xs leading-relaxed text-ink/50">{stat.label}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      <section id="agents" className="relative border-y border-ink/10 bg-cream-deep/60 py-16 sm:py-24">
        <div className="container">
          <Reveal>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <Badge dot>Three agents · one dashboard</Badge>
                <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                  Hire the team you never had time to <span className="italic text-primary">manage.</span>
                </h2>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-ink/55">
                Each agent owns one job. They share your knowledge base, your tone and one inbox.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {agents.map((agent, index) => (
              <Reveal key={agent.name} delay={index * 100} className={`group ${index === 1 ? "md:translate-y-6" : ""}`}>
                <SpotlightCard className="flex h-full flex-col border border-ink/10 bg-card p-6 shadow-soft">
                  <div className="flex items-start justify-between">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${agent.chip}`}>
                      <agent.icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-4xl leading-none text-ink/15">{agent.number}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-extrabold tracking-[-0.02em]">{agent.name}</h3>
                  <p className="mt-1 font-display text-xl italic text-primary">{agent.line}</p>
                  <p className="mt-3 text-sm leading-relaxed text-ink/55">{agent.copy}</p>
                  <ul className="mt-6 space-y-2 border-t border-ink/10 pt-4 text-[13px]">
                    {agent.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-ink/75">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <div className="spotlight spotlight-dark relative mt-12 overflow-hidden rounded-[2rem] bg-ink px-6 py-7 text-cream sm:px-9">
              <div className="absolute -right-6 -top-10 h-40 w-40 rounded-full bg-goldenrod/20 blur-2xl" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                      Plus a growth assistant
                    </p>
                    <p className="mt-1.5 max-w-xl font-display text-xl leading-snug sm:text-2xl">
                      “Send a Diwali offer to customers who visited last month.”
                    </p>
                    <p className="mt-1 text-xs text-cream/45">It drafts, asks once, then runs the whole thing.</p>
                  </div>
                </div>
                <Link href="/login" className="shrink-0">
                  <Button variant="gold">
                    Try it <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="how" className="container py-16 sm:py-24">
        <Reveal>
          <div className="max-w-2xl">
            <Badge dot tone="muted">Setup in one sitting</Badge>
            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              From zero to <span className="italic text-primary">working</span> in an afternoon.
            </h2>
          </div>
        </Reveal>
        <div className="relative mt-10 grid gap-8 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-7 hidden border-t border-dashed border-ink/20 md:block" />
          {steps.map((step, index) => (
            <Reveal key={step.number} delay={index * 100} className="relative">
              <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-ink/15 bg-cream font-display text-xl">
                {step.number}
              </span>
              <h3 className="mt-5 text-base font-extrabold tracking-[-0.01em]">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink/55">{step.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-ink/10 bg-gold py-16 sm:py-20">
        <div className="container grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink/70">Built for trust</p>
            <p className="mt-4 text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
              “I stopped losing enquiries at 11 pm. That alone paid for it.”
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-gold">
                AV
              </span>
              <div>
                <p className="text-sm font-extrabold">Dr. Ananya Verma</p>
                <p className="text-xs text-ink/70">Smile Care Dental · Bengaluru</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: "Approval-first", copy: "Nothing customer-facing sends without your tap." },
                { title: "Grounded AI", copy: "Answers only from your knowledge base. Never invents prices." },
                { title: "Human handoff", copy: "Complaints and medical questions come straight to you." },
                { title: "Audit trail", copy: "Every AI action, send and admin login is logged." },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-ink/15 bg-cream/40 p-4">
                  <Check className="h-4 w-4 text-ink" />
                  <p className="mt-3 text-[13px] font-extrabold">{item.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink/70">{item.copy}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="pricing" className="container py-16 sm:py-24">
        <Reveal>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Badge dot tone="muted">Simple pricing</Badge>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                One agent, or all <span className="italic text-primary">three.</span>
              </h2>
              <p className="mt-3 max-w-md text-sm text-ink/55">
                No setup fee. Cancel anytime. Prices include 18% GST at checkout.
              </p>
            </div>
            <Link href="/login" className="flex items-center gap-1.5 text-sm font-bold text-primary">
              Talk to the demo <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-10 grid items-stretch gap-4 md:grid-cols-3">
          {PLANS.map((plan, index) => {
            const featured = plan.agent === "chat";
            return (
              <Reveal key={plan.id} delay={index * 90} className={featured ? "md:-translate-y-3" : ""}>
                <div
                  className={`relative flex h-full flex-col rounded-[1.8rem] p-6 ${
                    featured
                      ? "bg-ink text-cream shadow-[0_30px_60px_-30px_rgba(10,23,16,0.8)]"
                      : "border border-ink/10 bg-card"
                  }`}
                >
                  {featured && (
                    <span className="absolute right-4 top-4 rounded-full bg-gold px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink">
                      Most popular
                    </span>
                  )}
                  <Star className={`h-4 w-4 ${featured ? "text-gold" : "text-primary"}`} />
                  <p className={`mt-4 text-[10px] font-bold uppercase tracking-[0.18em] ${featured ? "text-cream/45" : "text-ink/40"}`}>
                    {plan.agent === "gbp" ? "Google" : plan.agent === "chat" ? "WhatsApp Chat" : "Marketing"}
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold tracking-[-0.02em]">{plan.name}</h3>
                  <p className={`mt-1 text-xs ${featured ? "text-cream/55" : "text-ink/50"}`}>{plan.tagline}</p>
                  <p className="mt-5 text-4xl font-bold leading-none tracking-tight">
                    {formatMoney(plan.pricePaise)}
                    <span className={`ml-1 text-sm ${featured ? "text-cream/40" : "text-ink/40"}`}>/mo</span>
                  </p>
                  <ul className={`mt-5 flex-1 space-y-2 border-t pt-4 text-[13px] ${featured ? "border-white/10" : "border-ink/10"}`}>
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${featured ? "text-gold" : "text-primary"}`} />
                        <span className={featured ? "text-cream/70" : "text-ink/65"}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" className="mt-6">
                    <Button variant={featured ? "gold" : "outline"} className="w-full">
                      Start with this agent
                    </Button>
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <footer className="relative overflow-hidden bg-ink pb-8 pt-14 text-cream">
        <div className="aurora absolute inset-0 opacity-50" />
        <div className="container relative">
          <div className="flex flex-col gap-8 border-b border-white/10 pb-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <Brand tone="light" accent="gold" />
              <p className="mt-4 text-sm leading-relaxed text-cream/50">
                The AI marketing team for Indian local businesses. Built in Bengaluru, works on any phone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-cream/55">
              <Link href="#agents" className="hover:text-gold">Agents</Link>
              <Link href="/login" className="hover:text-gold">Log in</Link>
              <Link href="#how" className="hover:text-gold">How it works</Link>
              <Link href="/login" className="hover:text-gold">Start free</Link>
              <Link href="#pricing" className="hover:text-gold">Pricing</Link>
              <Link href="/login" className="hover:text-gold">Demo clinic</Link>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-white/10 pt-5 text-[11px] text-cream/35 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} GrowBuff · A demo MVP with sandbox integrations</p>
            <p>Made for the businesses that keep India running.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
