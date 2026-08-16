import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key() {
  const source = process.env.NOTIFICATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) throw new Error("NOTIFICATION_ENCRYPTION_KEY is required for Google token storage");
  return createHash("sha256").update(source).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((x) => x.toString("base64url")).join(".");
}

export function decryptJson<T>(payload: string): T {
  const [ivRaw, tagRaw, dataRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid encrypted token payload");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const clear = Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(clear) as T;
}
