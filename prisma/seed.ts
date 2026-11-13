/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { DEFAULT_HOURS } from "../src/lib/types";

const prisma = new PrismaClient();
const EMBED_DIM = 256;

/** Mirrors src/lib/ai/embed.ts so the seed stays dependency-free. */
function embed(text: string): number[] {
  const vector = new Array<number>(EMBED_DIM).fill(0);
  for (const token of text.toLowerCase().split(/[^a-z0-9\u0900-\u097F]+/)) {
    if (token.length < 2) continue;
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vector[Math.abs(h) % EMBED_DIM] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

function chunks(text: string, size = 700) {
  const clean = text.trim();
  if (clean.length <= size) return [clean];
  return clean.match(new RegExp(`[\\s\\S]{1,${size}}(?=\\s|$)`, "g")) ?? [clean];
}

function daysFromNow(days: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function dayStart(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

const SERVICES = [
  { name: "Dental cleaning & polishing", pricePaise: 150000, durationMin: 30 },
  { name: "Teeth whitening", pricePaise: 800000, durationMin: 60 },
  { name: "Braces consultation", pricePaise: 50000, durationMin: 30 },
  { name: "Root canal treatment", pricePaise: 700000, durationMin: 60 },
  { name: "Kids dental check-up", pricePaise: 80000, durationMin: 20 },
];

const FAQS = [
  { q: "Do you take walk-ins?", a: "Yes, we keep a few walk-in slots each morning, but booking on WhatsApp gets you a confirmed time and shorter wait." },
  { q: "How much is teeth cleaning?", a: "Dental cleaning and polishing is ₹1,500 and takes about 30 minutes." },
  { q: "Is teeth whitening safe?", a: "Our dentist checks your enamel first and uses a clinically approved whitening system. Suitability is decided only after an examination." },
  { q: "Where are you located?", a: "We are at 12th Main, Indiranagar, Bengaluru, above the bakery near 100 Feet Road. Free parking is available behind the building." },
  { q: "Do you accept insurance?", a: "We accept cash, UPI and cards. For insurance reimbursement we provide a detailed invoice and treatment summary." },
  { q: "Do you treat children?", a: "Yes, we have a dedicated kids' check-up for ₹800 and a paediatric-friendly team." },
];

async function seedPlans() {
  await prisma.plan.deleteMany();
  await prisma.plan.createMany({
    data: [
      {
        agent: "gbp",
        name: "Google Presence",
        pricePaise: 99900,
        limits: { gbp_post: 60 },
        features: ["Profile audit", "Local SEO & Maps", "AI posts", "Review replies & requests", "Analytics"],
      },
      {
        agent: "chat",
        name: "WhatsApp Chat Agent",
        pricePaise: 149900,
        limits: { ai_message: 2000 },
        features: ["24×7 replies", "Bookings", "Lead scoring", "Shared inbox"],
      },
      {
        agent: "marketing",
        name: "WhatsApp Marketing",
        pricePaise: 129900,
        limits: { campaign_message: 4000 },
        features: ["Segments", "AI campaigns", "Templates", "Automations"],
      },
    ],
  });
}

async function seedDemoTenant() {
  const tenant = await prisma.tenant.create({
    data: {
      name: "Smile Care Dental",
      business: {
        create: {
          name: "Smile Care Dental",
          category: "Dentist",
          city: "Bengaluru",
          address: "12th Main, Indiranagar, Bengaluru 560038",
          phone: "+919876543210",
          website: "https://smilecaredental.in",
          description:
            "Smile Care Dental is a family dental clinic in Indiranagar, Bengaluru. Our dentists handle cleaning, whitening, braces and root canals with gentle, pain-first care. Same-day appointments, evening slots and easy UPI payment. We speak English, Hindi and Kannada.",
          seoPrimaryKeyword: "dentist in Indiranagar",
          seoServiceAreas: ["Indiranagar", "Domlur", "Koramangala", "HAL", "CV Raman Nagar"],
          seoSecondaryCategories: ["Dental clinic", "Teeth whitening service", "Pediatric dentist", "Emergency dental clinic"],
          brandTone: "friendly",
          languages: ["en", "hi"],
          hours: DEFAULT_HOURS,
          services: SERVICES,
          faqs: FAQS,
          autoReplyReviews: false,
          onboardingStep: 4,
          completedAt: daysFromNow(-40),
        },
      },
    },
    include: { business: true },
  });
  const businessId = tenant.business!.id;

  const owner = await prisma.user.create({
    data: {
      phone: "+919876543210",
      name: "Dr. Ananya Sharma",
      locale: "en",
      memberships: { create: { tenantId: tenant.id, role: "owner" } },
    },
  });

  await prisma.connection.createMany({
    data: [
      {
        tenantId: tenant.id,
        provider: "google_business",
        status: "connected",
        externalId: `accounts/mock/locations/${tenant.id.slice(-6)}`,
        displayName: "Smile Care Dental — Indiranagar",
        accessTokenEnc: "v1:mock",
        meta: { mode: "mock" },
      },
      {
        tenantId: tenant.id,
        provider: "whatsapp",
        status: "connected",
        externalId: "mock_waba_smilecare",
        displayName: "WhatsApp +91 98765 43210",
        accessTokenEnc: "v1:mock",
        meta: { mode: "mock" },
      },
      {
        tenantId: tenant.id,
        provider: "google_calendar",
        status: "connected",
        externalId: "mock_cal_smilecare",
        displayName: "Smile Care Calendar",
        accessTokenEnc: "v1:mock",
        meta: { mode: "mock" },
      },
    ],
  });

  // ---- Knowledge base
  const docs = [
    {
      title: "Services and prices",
      source: "onboarding",
      content: `Smile Care Dental services and prices (all inclusive, no hidden charges):
- Dental cleaning and polishing: ₹1,500, about 30 minutes.
- Teeth whitening: ₹8,000 per session, about 60 minutes. Suitability decided after a dentist examination.
- Braces consultation: ₹500, adjusted against treatment if you start within 30 days.
- Root canal treatment: ₹7,000 onwards depending on the tooth; includes one follow-up.
- Kids dental check-up: ₹800, about 20 minutes.
We accept UPI, cards and cash. EMI is available for braces and root canals.`,
    },
    {
      title: "Timings, location and contact",
      source: "gbp",
      content: `Smile Care Dental is open Monday to Friday 10:00–19:00, Saturday 10:00–16:00, and closed on Sunday. We are at 12th Main, Indiranagar, Bengaluru 560038, above the bakery near 100 Feet Road. Free parking behind the building. Call or WhatsApp +91 98765 43210. Walk-ins are welcome in the morning, but booked patients are seen first.`,
    },
    {
      title: "Frequently asked questions",
      source: "faq",
      content: FAQS.map((faq) => `Q: ${faq.q}\nA: ${faq.a}`).join("\n\n"),
    },
    {
      title: "Appointments, cancellations and payment",
      source: "manual",
      content: `Appointments can be booked on WhatsApp, by phone, or through Google. Please arrive 10 minutes early for your first visit. Cancellations or rescheduling are free up to 4 hours before the appointment; after that a ₹200 slot fee applies. The first consultation includes an examination and a written treatment plan. We provide itemised invoices for insurance reimbursement and do not file insurance claims directly.`,
    },
    {
      title: "Safety and clinical policy",
      source: "manual",
      content: `Our dentists are registered with the Karnataka State Dental Council. We follow single-use instrument and sterilisation protocols. We do not diagnose, prescribe medicine, or give a treatment guarantee over WhatsApp. Suitability for whitening, braces or root canals is confirmed only after an in-person examination. Dental emergencies should call the clinic directly; for severe bleeding, swelling or breathing difficulty, please go to the nearest hospital.`,
    },
    {
      title: "Offers and memberships",
      source: "manual",
      content: `The Smile Care Family Plan is ₹2,999 per year for up to 4 family members and includes two cleanings each and 10% off other treatments. We do not currently run percentage discounts on whitening or braces. Ask the front desk about the current month's package instead of assuming an offer is active.`,
    },
  ];

  const keywordMap: Record<string, string[]> = {
    "Services and prices": ["price", "cost", "cleaning", "whitening", "braces", "root canal", "fee", "kitna"],
    "Timings, location and contact": ["hours", "open", "timing", "location", "address", "parking", "directions"],
    "Frequently asked questions": ["faq", "walk-in", "children", "insurance", "safe", "where"],
    "Appointments, cancellations and payment": ["book", "appointment", "cancel", "reschedule", "payment", "upi"],
    "Safety and clinical policy": ["safe", "sterilise", "guarantee", "emergency", "medical"],
    "Offers and memberships": ["offer", "membership", "discount", "plan"],
  };

  for (const doc of docs) {
    const created = await prisma.knowledgeDoc.create({
      data: {
        tenantId: tenant.id,
        title: doc.title,
        source: doc.source,
        content: doc.content,
      },
    });
    for (const piece of chunks(doc.content)) {
      await prisma.knowledgeChunk.create({
        data: {
          tenantId: tenant.id,
          docId: created.id,
          content: piece,
          embedding: embed(piece),
          keywords: keywordMap[doc.title] ?? [],
        },
      });
    }
  }

  // ---- Contacts
  const thisMonth = new Date();
  const birthday = new Date(thisMonth);
  birthday.setDate(Math.min(thisMonth.getDate() + 2, 28));

  const contactData = [
    { name: "Ananya Rao", phone: "+919845000001", tags: ["returning", "cleaning"], lastSeenAt: daysFromNow(-5), source: "chat", leadScore: 62 },
    { name: "Rohan Mehta", phone: "+919845000002", tags: ["new"], birthday, source: "chat", leadScore: 80 },
    { name: "Priya Nair", phone: "+919845000003", tags: ["price-enquiry"], lastSeenAt: daysFromNow(-70), source: "chat", leadScore: 70 },
    { name: "Kabir Shah", phone: "+919845000004", tags: ["whitening"], lastSeenAt: daysFromNow(-12), source: "gbp", leadScore: 30 },
    { name: "Meera Iyer", phone: "+919845000005", tags: ["returning"], lastSeenAt: daysFromNow(-30), optIn: false, optOutAt: daysFromNow(-10), source: "chat" },
    { name: "Arjun Singh", phone: "+919845000006", tags: ["returning", "braces"], lastSeenAt: daysFromNow(-65), source: "chat" },
    { name: "Sneha Kulkarni", phone: "+919845000007", tags: ["price-enquiry"], lastSeenAt: daysFromNow(-40), source: "import" },
    { name: "Vikram Desai", phone: "+919845000008", tags: ["new", "walk-in"], birthday, source: "gbp" },
    { name: "Farah Khan", phone: "+919845000009", tags: ["returning", "cleaning"], lastSeenAt: daysFromNow(-20), source: "chat" },
    { name: "Dev Patel", phone: "+919845000010", tags: ["cleaning"], lastSeenAt: daysFromNow(-100), source: "import" },
    { name: "Nisha Gupta", phone: "+919845000011", tags: ["new"], source: "chat" },
    { name: "Sameer Joshi", phone: "+919845000012", tags: ["braces"], lastSeenAt: daysFromNow(-8), source: "chat" },
    { name: "Lakshmi Menon", phone: "+919845000013", tags: ["returning"], lastSeenAt: daysFromNow(-15), source: "chat" },
    { name: "Aditya Verma", phone: "+919845000014", tags: ["new", "price-enquiry"], source: "chat" },
  ];

  const contacts: Record<string, { id: string; phone: string; name: string | null }> = {};
  for (const data of contactData) {
    const contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        ...data,
        locale: "en",
        optInAt: daysFromNow(-45),
      },
    });
    contacts[data.name] = { id: contact.id, phone: contact.phone, name: contact.name };
  }

  // ---- Conversations + messages
  const conversations: Record<string, { id: string }> = {};
  const conversationSeed = [
    {
      contact: "Ananya Rao",
      aiPaused: false,
      preview: "Perfect, see you Saturday at 10:30!",
      messages: [
        { direction: "in", role: "customer", body: "Hi, do you have a slot for cleaning this Saturday?" },
        { direction: "out", role: "ai", body: "Happy to book you in for Dental cleaning & polishing! These are open:\n\n1. Sat, 15 Nov, 10:30 am\n2. Sat, 15 Nov, 12:00 pm\n3. Sat, 15 Nov, 3:00 pm\n\nReply with 1, 2 or 3." },
        { direction: "in", role: "customer", body: "1" },
        { direction: "out", role: "ai", body: "You're booked! Sat, 15 Nov, 10:30 am at Smile Care Dental. We'll send a reminder a day before. Reply RESCHEDULE if plans change." },
        { direction: "in", role: "customer", body: "Perfect, see you Saturday at 10:30!" },
      ],
    },
    {
      contact: "Priya Nair",
      aiPaused: true,
      handoffReason: "Price not confirmed in knowledge base",
      preview: "I don't want to give you the wrong information…",
      messages: [
        { direction: "in", role: "customer", body: "How much for the clear aligners? Is there any discount if I pay full?" },
        { direction: "out", role: "system", body: "I don't want to give you the wrong information. I've asked the team at Smile Care Dental to reply here — they'll be with you shortly." },
      ],
    },
    {
      contact: "Rohan Mehta",
      aiPaused: false,
      preview: "Sure — these are open for a braces consultation:",
      messages: [
        { direction: "in", role: "customer", body: "I want to book a braces consultation for next week" },
        { direction: "out", role: "ai", body: "Happy to book you in for Braces consultation! These are open:\n\n1. Mon, 17 Nov, 10:00 am\n2. Mon, 17 Nov, 11:30 am\n3. Tue, 18 Nov, 10:00 am\n\nReply with 1, 2 or 3." },
      ],
    },
    {
      contact: "Kabir Shah",
      aiPaused: true,
      handoffReason: "Customer complaint",
      preview: "I've asked the team to reply here…",
      messages: [
        { direction: "in", role: "customer", body: "The whitening did nothing and I waited 40 minutes. I want a refund." },
        { direction: "out", role: "system", body: "I don't want to give you the wrong information. I've asked the team at Smile Care Dental to reply here — they'll be with you shortly." },
      ],
    },
    {
      contact: "Sneha Kulkarni",
      aiPaused: false,
      preview: "Cleaning and polishing is ₹1,500 and takes about 30 minutes.",
      messages: [
        { direction: "in", role: "customer", body: "Kitna charge hai cleaning ka?" },
        { direction: "out", role: "ai", body: "Cleaning aur polishing ₹1,500 hai aur lagbhag 30 minute lagte hain. Appointment book karna chahenge?" },
        { direction: "in", role: "customer", body: "Haan, weekend par mil sakta hai?" },
      ],
    },
  ];

  for (const seed of conversationSeed) {
    const contact = contacts[seed.contact];
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        contactId: contact.id,
        aiPaused: seed.aiPaused,
        handoffReason: seed.handoffReason,
        lastMessagePreview: seed.preview,
        unread: seed.aiPaused ? 1 : 0,
        lastMessageAt: new Date(),
        state: seed.contact === "Rohan Mehta" ? { pendingService: "Braces consultation" } : {},
      },
    });
    conversations[seed.contact] = { id: conversation.id };
    for (const message of seed.messages) {
      await prisma.message.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          direction: message.direction,
          role: message.role,
          body: message.body,
          status: message.direction === "in" ? "delivered" : "read",
        },
      });
    }
  }

  // ---- Leads
  await prisma.lead.createMany({
    data: [
      { tenantId: tenant.id, contactId: contacts["Ananya Rao"].id, conversationId: conversations["Ananya Rao"].id, name: "Ananya Rao", phone: contacts["Ananya Rao"].phone, intent: "booking", score: 82, status: "booked" },
      { tenantId: tenant.id, contactId: contacts["Priya Nair"].id, conversationId: conversations["Priya Nair"].id, name: "Priya Nair", phone: contacts["Priya Nair"].phone, intent: "price", score: 68, status: "new" },
      { tenantId: tenant.id, contactId: contacts["Rohan Mehta"].id, conversationId: conversations["Rohan Mehta"].id, name: "Rohan Mehta", phone: contacts["Rohan Mehta"].phone, intent: "booking", score: 78, status: "new" },
      { tenantId: tenant.id, contactId: contacts["Kabir Shah"].id, conversationId: conversations["Kabir Shah"].id, name: "Kabir Shah", phone: contacts["Kabir Shah"].phone, intent: "complaint", score: 74, status: "contacted" },
      { tenantId: tenant.id, contactId: contacts["Sneha Kulkarni"].id, conversationId: conversations["Sneha Kulkarni"].id, name: "Sneha Kulkarni", phone: contacts["Sneha Kulkarni"].phone, intent: "price", score: 55, status: "new" },
      { tenantId: tenant.id, contactId: contacts["Aditya Verma"].id, name: "Aditya Verma", phone: contacts["Aditya Verma"].phone, intent: "enquiry", score: 35, status: "contacted" },
    ],
  });

  // ---- Bookings
  const bookings = await Promise.all([
    prisma.booking.create({ data: { tenantId: tenant.id, contactId: contacts["Ananya Rao"].id, serviceName: "Dental cleaning & polishing", pricePaise: 150000, startsAt: daysFromNow(5, 10), endsAt: daysFromNow(5, 11), status: "confirmed", source: "whatsapp" } }),
    prisma.booking.create({ data: { tenantId: tenant.id, contactId: contacts["Sameer Joshi"].id, serviceName: "Braces consultation", pricePaise: 50000, startsAt: daysFromNow(1, 12), endsAt: daysFromNow(1, 13), status: "confirmed", source: "whatsapp" } }),
    prisma.booking.create({ data: { tenantId: tenant.id, contactId: contacts["Lakshmi Menon"].id, serviceName: "Teeth whitening", pricePaise: 800000, startsAt: daysFromNow(3, 15), endsAt: daysFromNow(3, 16), status: "pending", source: "whatsapp" } }),
    prisma.booking.create({ data: { tenantId: tenant.id, contactId: contacts["Rohan Mehta"].id, serviceName: "Dental cleaning & polishing", pricePaise: 150000, startsAt: daysFromNow(-3, 11), endsAt: daysFromNow(-3, 12), status: "completed", source: "whatsapp" } }),
    prisma.booking.create({ data: { tenantId: tenant.id, contactId: contacts["Farah Khan"].id, serviceName: "Kids dental check-up", pricePaise: 80000, startsAt: daysFromNow(-6, 16), endsAt: daysFromNow(-6, 17), status: "completed", source: "google" } }),
    prisma.booking.create({ data: { tenantId: tenant.id, contactId: contacts["Dev Patel"].id, serviceName: "Dental cleaning & polishing", pricePaise: 150000, startsAt: daysFromNow(-14, 10), endsAt: daysFromNow(-14, 11), status: "completed", source: "whatsapp" } }),
  ]);

  // ---- Templates & campaigns
  const template = await prisma.template.create({
    data: {
      tenantId: tenant.id,
      name: "festive_cleaning_2025",
      category: "MARKETING",
      language: "en",
      body: "Hi {{name}}! Festive wishes from Smile Care Dental. A fresh smile for the season — reply BOOK for a cleaning slot this week. Reply STOP to unsubscribe.",
      variables: ["name"],
      metaStatus: "approved",
      metaTemplateId: "mock_tpl_approved_1",
    },
  });
  const pendingTemplate = await prisma.template.create({
    data: {
      tenantId: tenant.id,
      name: "winback_60day_2025",
      category: "MARKETING",
      language: "en",
      body: "Hi {{name}}, we've missed you at Smile Care Dental! Reply BOOK for a cleaning slot. Reply STOP to unsubscribe.",
      variables: ["name"],
      metaStatus: "submitted",
      metaTemplateId: "mock_tpl_pending_1",
    },
  });

  const sentCampaign = await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "Diwali fresh-smile package",
      goal: "festival",
      segment: { tags: ["returning", "cleaning"] },
      templateId: template.id,
      messageBody: template.body,
      status: "sent",
      sentAt: daysFromNow(-4),
      stats: { audience: 84, delivered: 81, read: 52, replied: 9, failed: 3 },
    },
  });
  await prisma.campaign.create({
    data: {
      tenantId: tenant.id,
      name: "We miss you — 60 days",
      goal: "win_back",
      segment: { inactiveDays: 60 },
      templateId: pendingTemplate.id,
      messageBody: pendingTemplate.body,
      status: "pending_approval",
      stats: { audience: 3, delivered: 0, read: 0, replied: 0, failed: 0 },
    },
  });
  const recipientContacts = ["Dev Patel", "Arjun Singh", "Priya Nair"];
  for (const name of recipientContacts) {
    await prisma.campaignRecipient.create({
      data: {
        tenantId: tenant.id,
        campaignId: sentCampaign.id,
        contactId: contacts[name].id,
        status: name === "Priya Nair" ? "replied" : "read",
        sentAt: daysFromNow(-4),
      },
    });
  }

  // ---- Automations
  await prisma.automation.createMany({
    data: [
      { tenantId: tenant.id, type: "appointment_reminder", name: "Appointment reminder", enabled: true, config: { hoursBefore: 24 } },
      { tenantId: tenant.id, type: "review_request", name: "Post-visit review request", enabled: true, config: { delayHours: 20 } },
      { tenantId: tenant.id, type: "birthday_offer", name: "Birthday offer", enabled: true, config: { discountNote: "family plan" } },
      { tenantId: tenant.id, type: "win_back", name: "Win-back after 60 days", enabled: true, config: { inactiveDays: 60, maxAttempts: 2 } },
      { tenantId: tenant.id, type: "auto_followup", name: "Quiet chat follow-up", enabled: true, config: { delayHours: 4, maxAttempts: 2 } },
    ],
  });

  // ---- GBP posts and reviews
  await prisma.gbpPost.createMany({
    data: [
      {
        tenantId: tenant.id,
        type: "update",
        title: "Evening dental slots in Indiranagar",
        body: "Working late? Smile Care Dental stays open until 7 pm on weekdays. Book a cleaning or check-up after work — same-day slots are often available. Call +91 98765 43210.",
        keywords: ["dentist Indiranagar", "evening dentist Bengaluru"],
        status: "published",
        publishedAt: daysFromNow(-6),
        externalId: "mock_post_1",
      },
      {
        tenantId: tenant.id,
        type: "offer",
        title: "Family Plan: 4 cleanings a year",
        body: "The Smile Care Family Plan covers up to 4 family members with two cleanings each for ₹2,999 a year. Ask the front desk for details.",
        keywords: ["family dentist Indiranagar", "dental plan Bengaluru"],
        status: "published",
        publishedAt: daysFromNow(-13),
        externalId: "mock_post_2",
      },
      {
        tenantId: tenant.id,
        type: "update",
        title: "Kids' check-ups without the fuss",
        body: "A friendly first dental visit for your child: 20 minutes, a gentle check-up and a sticker at the end. ₹800. Book on WhatsApp.",
        keywords: ["kids dentist Bengaluru", "pediatric dentist Indiranagar"],
        status: "pending_approval",
      },
    ],
  });

  await prisma.gbpReview.createMany({
    data: [
      { tenantId: tenant.id, externalId: "rev_1", author: "Aarav K.", rating: 5, text: "Dr Sharma explained everything and the cleaning was painless. Booked on WhatsApp in a minute.", sentiment: "positive", status: "replied", reply: "Thank you so much, Aarav! The team is glad the visit was easy — see you next time.", repliedAt: daysFromNow(-5), reviewedAt: daysFromNow(-7) },
      { tenantId: tenant.id, externalId: "rev_2", author: "Ishita M.", rating: 5, text: "Best clinic in Indiranagar. Kids were comfortable and the billing was clear.", sentiment: "positive", status: "replied", reply: "Thank you, Ishita! We love making first visits calm ones.", repliedAt: daysFromNow(-9), reviewedAt: daysFromNow(-12) },
      { tenantId: tenant.id, externalId: "rev_3", author: "Rahul S.", rating: 2, text: "Waited 35 minutes past my appointment and the whitening result was not what I expected.", sentiment: "negative", status: "needs_approval", reply: "We're sorry your visit didn't meet expectations, Rahul. Please call us on +91 98765 43210 so we can make it right — your feedback helps us improve.", reviewedAt: daysFromNow(-1) },
      { tenantId: tenant.id, externalId: "rev_4", author: "Neha B.", rating: 4, text: "Clean clinic, gentle dentist. Reception could be quicker.", sentiment: "positive", status: "new", reviewedAt: daysFromNow(-2) },
      { tenantId: tenant.id, externalId: "rev_5", author: "Suresh P.", rating: 3, text: "Treatment was fine but parking is hard to find.", sentiment: "neutral", status: "needs_approval", reply: "Thanks for the honest feedback, Suresh. Free parking is available behind the building — call us next time and we'll guide you in.", reviewedAt: daysFromNow(-15) },
    ],
  });

  await prisma.seoKeyword.createMany({
    data: [
      { tenantId: tenant.id, keyword: "dentist in indiranagar", intent: "local", demand: 82, difficulty: 55, priority: 96, tracked: true },
      { tenantId: tenant.id, keyword: "best dentist in bengaluru", intent: "commercial", demand: 72, difficulty: 68, priority: 84, tracked: true },
      { tenantId: tenant.id, keyword: "teeth whitening in indiranagar", intent: "transactional", demand: 68, difficulty: 50, priority: 80, tracked: true },
      { tenantId: tenant.id, keyword: "root canal cost in bengaluru", intent: "commercial", demand: 55, difficulty: 58, priority: 66, tracked: true },
      { tenantId: tenant.id, keyword: "kids dentist indiranagar", intent: "local", demand: 45, difficulty: 42, priority: 62, tracked: true },
      { tenantId: tenant.id, keyword: "dental cleaning indiranagar", intent: "transactional", demand: 64, difficulty: 48, priority: 74, tracked: false },
      { tenantId: tenant.id, keyword: "emergency dentist bengaluru", intent: "transactional", demand: 50, difficulty: 64, priority: 60, tracked: false },
      { tenantId: tenant.id, keyword: "family dentist in indiranagar", intent: "local", demand: 40, difficulty: 40, priority: 52, tracked: false },
    ],
  });

  await prisma.seoContent.createMany({
    data: [
      {
        tenantId: tenant.id,
        type: "page_meta",
        keyword: "dentist in indiranagar",
        title: "Home page title & meta",
        metaTitle: "Dentist in Indiranagar | Smile Care Dental",
        metaDescription:
          "Family dental clinic in Indiranagar, Bengaluru for cleaning, whitening, braces and root canals. Evening slots and easy WhatsApp booking.",
        body: "H1: Dentist in Indiranagar\nH2: Family dental care in Bengaluru\nH2: Services\nH2: Book an appointment",
        status: "approved",
      },
      {
        tenantId: tenant.id,
        type: "service_page",
        keyword: "teeth whitening in indiranagar",
        title: "Teeth whitening page in Indiranagar",
        metaTitle: "Teeth Whitening in Indiranagar | Smile Care",
        metaDescription:
          "Professional teeth whitening in Indiranagar with an enamel check first. Book a consultation with Smile Care Dental in Bengaluru.",
        body:
          "# Teeth Whitening in Indiranagar\n\nSmile Care Dental offers teeth whitening for adults in Indiranagar, Bengaluru. Our dentist checks your enamel and suitability before treatment.\n\n## What is included\n- A pre-treatment examination\n- In-clinic whitening session\n- Aftercare guidance\n\n## Book an appointment\nCall +91 98765 43210 or book on WhatsApp.",
        status: "draft",
      },
    ],
  });

  // ---- GBP metrics (30 days)
  const metricData = [];
  for (let i = 29; i >= 0; i--) {
    const base = 30 + ((i * 7) % 24);
    const weekend = [0, 6].includes(dayStart(i).getDay());
    metricData.push({
      tenantId: tenant.id,
      date: dayStart(i),
      calls: weekend ? 2 + (i % 3) : base % 9,
      directions: weekend ? 4 + (i % 4) : 8 + (i % 11),
      websiteClicks: 3 + (i % 6),
      searchViews: 80 + ((i * 13) % 70),
      mapViews: 55 + ((i * 17) % 45),
    });
  }
  await prisma.gbpMetricSnapshot.createMany({ data: metricData });

  // ---- Billing
  const gst = (amount: number) => Math.round(amount * 0.18);
  await prisma.subscription.createMany({
    data: [
      { tenantId: tenant.id, agent: "gbp", plan: "Google Presence", status: "active", pricePaise: 99900, gateway: "mock", renewsAt: daysFromNow(18) },
      { tenantId: tenant.id, agent: "chat", plan: "WhatsApp Chat Agent", status: "active", pricePaise: 149900, gateway: "mock", renewsAt: daysFromNow(18) },
      { tenantId: tenant.id, agent: "marketing", plan: "WhatsApp Marketing", status: "active", pricePaise: 129900, gateway: "mock", renewsAt: daysFromNow(18) },
    ],
  });
  await prisma.invoice.createMany({
    data: [
      { tenantId: tenant.id, number: "GB-202510-A1B", amountPaise: 379700, gstPaise: gst(379700), totalPaise: 379700 + gst(379700), status: "paid", periodStart: daysFromNow(-30), periodEnd: daysFromNow(-1) },
      { tenantId: tenant.id, number: "GB-202509-C4D", amountPaise: 379700, gstPaise: gst(379700), totalPaise: 379700 + gst(379700), status: "paid", periodStart: daysFromNow(-60), periodEnd: daysFromNow(-31) },
    ],
  });

  await prisma.usageEvent.createMany({
    data: [
      { tenantId: tenant.id, type: "ai_message", quantity: 312 },
      { tenantId: tenant.id, type: "gbp_post", quantity: 8 },
      { tenantId: tenant.id, type: "campaign_message", quantity: 84 },
      { tenantId: tenant.id, type: "assistant_message", quantity: 12 },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { tenantId: tenant.id, actorUserId: owner.id, actorType: "user", action: "gbp.post_published", target: "Evening dental slots in Indiranagar" },
      { tenantId: tenant.id, actorType: "ai", action: "chat.handoff", target: conversations["Priya Nair"].id, meta: { reason: "Price not confirmed in knowledge base" } },
      { tenantId: tenant.id, actorType: "system", action: "campaign.sent", target: sentCampaign.id, meta: { delivered: 81 } },
    ],
  });

  await prisma.job.create({
    data: {
      tenantId: tenant.id,
      type: "appointment_reminder",
      payload: { bookingId: bookings[1].id },
      runAt: new Date(Date.now() + 3600_000),
      idempotencyKey: `reminder:${bookings[1].id}`,
    },
  });

  return { tenantId: tenant.id, businessId };
}

async function seedSecondTenant() {
  const tenant = await prisma.tenant.create({
    data: {
      name: "Glow Studio",
      business: {
        create: {
          name: "Glow Studio",
          category: "Beauty salon",
          city: "Pune",
          address: "Lane 6, Koregaon Park, Pune",
          phone: "+919812345678",
          description: "A small unisex salon in Koregaon Park for haircuts, facials and bridal styling.",
          brandTone: "warm",
          languages: ["en", "hi"],
          hours: DEFAULT_HOURS,
          services: [
            { name: "Haircut & styling", pricePaise: 90000, durationMin: 45 },
            { name: "Hydrafacial", pricePaise: 350000, durationMin: 60 },
          ],
          faqs: [],
        },
      },
    },
    include: { business: true },
  });
  const owner = await prisma.user.create({
    data: {
      phone: "+919812345678",
      name: "Ritu Kapoor",
      memberships: { create: { tenantId: tenant.id, role: "owner" } },
    },
  });
  await prisma.contact.createMany({
    data: [
      { tenantId: tenant.id, phone: "+919900000001", name: "Tanvi S", tags: ["bridal"], optIn: true, source: "chat", lastSeenAt: daysNow(-20) },
      { tenantId: tenant.id, phone: "+919900000002", name: "Rhea M", tags: ["facial"], optIn: true, source: "chat", lastSeenAt: daysNow(-55) },
      { tenantId: tenant.id, phone: "+919900000003", name: "Aman K", tags: [], optIn: false, source: "import" },
    ],
  });
  await prisma.subscription.create({
    data: { tenantId: tenant.id, agent: "gbp", plan: "Google Presence", status: "active", pricePaise: 99900, gateway: "mock" },
  });
  return { tenantId: tenant.id, ownerId: owner.id };
}

function daysNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("Seeding GrowBuff…");
  await prisma.tenant.deleteMany({ where: { name: { in: ["Smile Care Dental", "Glow Studio"] } } });
  await prisma.user.deleteMany({ where: { phone: { in: ["+919876543210", "+919812345678", "+919000000000"] } } });
  await prisma.plan.deleteMany();

  await seedPlans();
  const demo = await seedDemoTenant();
  await seedSecondTenant();

  const admin = await prisma.user.create({
    data: { phone: "+919000000000", name: "GrowBuff Ops", email: "ops@growbuff.com", isAdmin: true },
  });

  console.log("✓ Demo tenant:", demo.tenantId);
  console.log("✓ Login phone: 9876543210 (OTP is shown in the app in mock mode)");
  console.log("✓ Admin phone: 9000000000 (id", admin.id, ")");
  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
