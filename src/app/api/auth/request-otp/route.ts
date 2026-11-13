import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOtp } from "@/lib/auth";

const schema = z.object({ phone: z.string().min(6) });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
    }
    const result = await requestOtp(parsed.data.phone);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
