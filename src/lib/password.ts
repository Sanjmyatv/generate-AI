import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Hashes a password as "scrypt$<salt>$<hash>" (both base64). Node's built-in scrypt, no extra dependency. */
export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

// Verified against when the email is unknown, so a miss costs the same as a wrong password.
const DUMMY_HASH = `scrypt$${Buffer.alloc(SALT_LENGTH).toString("base64")}$${Buffer.alloc(KEY_LENGTH).toString("base64")}`;

/** Constant-time check of a password against a stored hash. Pass null to spend equal time on a miss. */
export async function verifyPassword(password: string, stored: string | null) {
  const [scheme, salt, hash] = (stored ?? DUMMY_HASH).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"));
  return stored !== null && expected.length === actual.length && timingSafeEqual(expected, actual);
}
