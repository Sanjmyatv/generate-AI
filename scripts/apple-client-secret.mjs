// Generates the AUTH_APPLE_SECRET value (a signed JWT) for Sign in with Apple.
// Apple limits its lifetime to 6 months, so re-run this and update the variable before it expires.
//
// Usage:
//   APPLE_TEAM_ID=XXXXXXXXXX APPLE_KEY_ID=YYYYYYYYYY APPLE_CLIENT_ID=com.example.web \
//   node scripts/apple-client-secret.mjs path/to/AuthKey_YYYYYYYYYY.p8
import { readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID } = process.env;
const keyPath = process.argv[2];

if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_CLIENT_ID || !keyPath) {
  console.error(
    "Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID and pass the .p8 key file path.",
  );
  process.exit(1);
}

const key = await importPKCS8(readFileSync(keyPath, "utf8"), "ES256");
const now = Math.floor(Date.now() / 1000);

const secret = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
  .setIssuer(APPLE_TEAM_ID)
  .setIssuedAt(now)
  .setExpirationTime(now + 60 * 60 * 24 * 180)
  .setAudience("https://appleid.apple.com")
  .setSubject(APPLE_CLIENT_ID)
  .sign(key);

console.log(secret);
