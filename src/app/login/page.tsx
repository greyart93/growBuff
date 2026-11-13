"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2, Phone, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("9876543210");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send code");
      setDevCode(data.devCode ?? null);
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not verify code");
      router.push(data.hasTenant ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  async function googleLogin() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@gmail.com", name: "Google Owner" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Google sign-in failed");
      router.push(data.hasTenant ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-cream lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="aurora absolute inset-0 opacity-80" />
        <div className="grid-lines absolute inset-0" />
        <div className="absolute -left-24 bottom-10 h-72 w-72 rounded-full border border-lime/15" />
        <div className="absolute right-10 top-24 h-40 w-40 rounded-full border border-cream/10" />

        <Link href="/" className="relative w-fit">
          <Brand tone="light" />
        </Link>

        <div className="relative max-w-lg">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-lime/70">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" /> The demo clinic
          </p>
          <p className="mt-5 text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
            Marketing that works
            <br />
            while you treat
            <br />
            <span className="italic text-lime">patients.</span>
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/55">
            Smile Care Dental, Indiranagar. One workspace where three AI agents answer, publish and bring
            people back.
          </p>
          <ul className="mt-8 space-y-2.5 text-[13px] text-cream/65">
            {["Replies in English and हिन्दी, grounded in your facts", "Approves every campaign before it sends", "Hands off complaints and medical questions"].map(
              (item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
                  {item}
                </li>
              )
            )}
          </ul>
        </div>

        <div className="relative flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["AV", "RS", "MK"].map((initials) => (
                <span
                  key={initials}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-cream text-[9px] font-extrabold text-ink"
                >
                  {initials}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-cream/45">
              <span className="font-bold text-cream">3 agents</span> · working right now
            </p>
          </div>
          <span className="text-5xl font-bold leading-none text-lime/20">✳</span>
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col px-4 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:hidden">
            <Brand />
          </Link>
          <Link
            href="/"
            className="ml-auto flex items-center gap-1.5 rounded-full border border-ink/10 bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <div className="animate-page-in">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/55">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-deep" />
              {step === "phone" ? "Start free · no card" : "One-time code"}
            </p>
            <h1 className="mt-3 text-[1.75rem] leading-tight tracking-tight sm:text-[2.4rem]">
              {step === "phone" ? (
                <>
                  Log in or create
                  <br />
                  your <span className="italic text-primary">business.</span>
                </>
              ) : (
                <>
                  Enter the
                  <br />
                  <span className="italic text-primary">6-digit code.</span>
                </>
              )}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {step === "phone"
                ? "We send a one-time code to your phone. No password to remember."
                : `Sent to ${phone}. In sandbox mode, the code is shown right here.`}
            </p>

            <div className="mt-7 rounded-[1.7rem] border border-ink/10 bg-card p-5 shadow-soft sm:p-6">
              {step === "phone" ? (
                <form onSubmit={requestCode} className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Phone number</Label>
                    <div className="flex items-center gap-2">
                      <span className="flex h-12 items-center rounded-xl border border-ink/15 bg-cream px-3 text-sm font-bold">
                        +91
                      </span>
                      <Input
                        id="phone"
                        inputMode="numeric"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="98765 43210"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="lime" size="lg" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                    Send me a code
                  </Button>
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-ink/10" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
                      or
                    </span>
                    <span className="h-px flex-1 bg-ink/10" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={googleLogin}
                    disabled={loading}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h6a5.1 5.1 0 0 1-2.2 3.3v2.8h3.6c2.1-2 3.2-4.8 3.2-8Z" />
                      <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.9A11 11 0 0 0 12 23Z" />
                      <path fill="#FBBC05" d="M6 14.2a6.6 6.6 0 0 1 0-4.2V7H2.3a11 11 0 0 0 0 10l3.7-2.8Z" />
                      <path fill="#EA4335" d="M12 5.5c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7L6 9.9c.9-2.5 3.2-4.4 6-4.4Z" />
                    </svg>
                    Continue with Google
                    <span className="ml-1 rounded-full bg-ink/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                      Sandbox
                    </span>
                  </Button>
                  <FieldError>{error}</FieldError>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Demo clinic: <span className="font-bold text-foreground">9876543210</span> · Admin:{" "}
                    <span className="font-bold text-foreground">9000000000</span>
                  </p>
                </form>
              ) : (
                <form onSubmit={verify} className="space-y-4">
                  {devCode && (
                    <div className="relative overflow-hidden rounded-2xl bg-lime px-4 py-3 text-center text-ink">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ink/50">
                        Sandbox code
                      </p>
                      <p className="font-display text-[2rem] tracking-[0.3em]">{devCode}</p>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="code">6-digit code</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      className="text-center text-2xl tracking-[0.5em]"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="lime"
                    size="lg"
                    className="w-full"
                    disabled={loading || code.length !== 6}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Verify and continue
                  </Button>
                  <FieldError>{error}</FieldError>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setCode("");
                      setError(null);
                    }}
                    className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Change phone number
                  </button>
                </form>
              )}
            </div>

            <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Tokens are encrypted at rest. Marketing messages require opt-in and an approved WhatsApp
              template. Customers can opt out with STOP at any time.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
