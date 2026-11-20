/**
 * Seeded reviewer accounts. Shown on the login screen on purpose so sharing
 * can be demonstrated without creating a sign-up flow.
 */
export const DEMO_PASSWORD = "paper123";

export const DEMO_ACCOUNTS = [
  {
    email: "alex@ajaia.test",
    name: "Alex Rivera",
    password: DEMO_PASSWORD,
    note: "Owns the sample document",
  },
  {
    email: "jordan@ajaia.test",
    name: "Jordan Lee",
    password: DEMO_PASSWORD,
    note: "Share Alex's document with this account",
  },
  {
    email: "sam@ajaia.test",
    name: "Sam Okonkwo",
    password: DEMO_PASSWORD,
    note: "Has no access until someone shares",
  },
] as const;
