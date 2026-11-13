import { NextResponse } from "next/server";
import { apiSession, normalizePhone } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await apiSession();
  if (!session?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { csv?: string };
  const csv = (body.csv ?? "").trim();
  if (!csv) return NextResponse.json({ error: "Paste a CSV first" }, { status: 400 });

  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return NextResponse.json({ error: "No rows found" }, { status: 400 });

  const header = lines[0].toLowerCase().includes("phone")
    ? lines[0].toLowerCase().split(",").map((cell) => cell.trim())
    : ["name", "phone", "tags", "optin"];
  const rows = lines[0].toLowerCase().includes("phone") ? lines.slice(1) : lines;
  const index = (key: string) => header.indexOf(key);
  const database = db(session.tenantId);

  let imported = 0;
  let skipped = 0;
  let optedIn = 0;

  for (const row of rows) {
    const cells = row.split(",").map((cell) => cell.trim());
    const phone = normalizePhone(cells[index("phone")] ?? "");
    if (!phone) {
      skipped++;
      continue;
    }
    const optIn = String(cells[index("optin")] ?? cells[index("opt_in")] ?? "").toLowerCase() === "true";
    const tags = (cells[index("tags")] ?? "")
      .split(/[;|]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6);

    await database.contact.upsert({
      where: { tenantId_phone: { tenantId: session.tenantId, phone } },
      create: {
        tenantId: session.tenantId,
        phone,
        name: cells[index("name")] || phone.slice(-4),
        tags,
        source: "import",
        optIn,
        optInAt: optIn ? new Date() : null,
      },
      update: {
        tags,
        optIn,
        ...(optIn ? { optInAt: new Date(), optOutAt: null } : {}),
      },
    });
    imported++;
    if (optIn) optedIn++;
  }

  return NextResponse.json({ imported, skipped, optedIn });
}
