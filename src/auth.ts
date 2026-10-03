import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { findOrCreateUser, type OAuthProvider } from "@/lib/users";

// Providers are only enabled when their credentials exist, so the app still
// runs (as guest-only) before Google/Apple are configured.
const providers: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);
if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) providers.push(Apple);

export const enabledProviders: OAuthProvider[] = [
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? (["google"] as const) : []),
  ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET ? (["apple"] as const) : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  // JWT sessions keep the user logged in across visits until logout/expiry.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // `account` is only present on the sign-in request itself.
      if (account && profile && (account.provider === "google" || account.provider === "apple")) {
        const dbUser = await findOrCreateUser({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          email: profile.email,
          // Google sends a boolean, Apple sends the string "true".
          emailVerified: String(profile.email_verified) === "true",
          name: user?.name ?? profile.name,
        });
        token.uid = dbUser.id;
        token.publicId = dbUser.publicId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      if (token.publicId) session.user.publicId = token.publicId;
      return session;
    },
  },
});
