// Fixed values for the end-to-end run. The ports differ from the usual 3000 and 4000, so a
// run never collides with a development server, and the admin login exists only for the test API.
export const E2E = {
  webUrl: "http://localhost:3010",
  apiUrl: "http://localhost:4010",
  adminEmail: "e2e-admin@freyya.test",
  adminPassword: "e2e-only-passphrase",
  // Hash of the password above, made with `npm run admin:hash`. Not a secret.
  adminPasswordHash:
    "scrypt$fb9d738ee78c17c496adbc5a0cac7855$711334458e4d1f18d0f435ff3f2421ac70a90c251db4d58a952626c84eecd28b4eb9491acd7858c13855a13219dc41e5f9615a5dce80fe499d848683a6816d75",
} as const;
