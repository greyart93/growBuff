import crypto from "node:crypto";

const SECRET = process.env.SESSION_SECRET || "growbuff-dev-session-secret";

function encryptionKey(): Buffer {
  const configured = process.env.APP_ENCRYPTION_KEY;
  if (configured && /^[0-9a-fA-F]{64}$/.test(configured)) {
    return Buffer.from(configured, "hex");
  }
  // Dev fallback: deterministic key so local restarts can still decrypt.
  return crypto.createHash("sha256").update(`${SECRET}:growbuff-encryption`).digest();
}

/** AES-256-GCM encryption for OAuth / WhatsApp tokens at rest. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== "v1") return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashOtp(phone: string, code: string) {
  return crypto.createHmac("sha256", SECRET).update(`${phone}:${code}`).digest("hex");
}

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function timingSafeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Meta sends X-Hub-Signature-256: sha256=<hmac of raw body>. */
export function verifySha256Signature(rawBody: string, header: string | null, secret: string) {
  if (!secret) return false; // callers may explicitly bypass this in mock mode
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(expected, header.slice(7));
}
