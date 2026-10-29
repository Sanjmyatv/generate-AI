import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { findOrCreateUser, verifyPasswordLogin, type OAuthProvider } from "@/lib/users";

/**
 * Sign-in is Google and Apple only. Email + password is the older method: it stays off unless
 * ENABLE_EMAIL_LOGIN=1, which keeps accounts created with a password reachable (their email
 * still links to the same account when they continue with Google or Apple).
 */
export const emailLoginEnabled = process.env.ENABLE_EMAIL_LOGIN === "1";

// Google/Apple are only enabled when their credentials exist.
const providers: Provider[] = [];
if (emailLoginEnabled) {
  providers.push(
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const user = await verifyPasswordLogin(credentials?.email, credentials?.password);
        return user ? { id: user.id, name: user.name, email: user.email, publicId: user.publicId } : null;
      },
    }),
  );
}
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
      if (account?.provider === "credentials" && user?.id) {
        token.uid = user.id;
        token.publicId = (user as { publicId?: string }).publicId;
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
