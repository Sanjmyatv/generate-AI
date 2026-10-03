import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Internal database user id. */
      id: string;
      /** Public, immutable id shown to the user (e.g. USR_829381). */
      publicId: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    publicId?: string;
  }
}
