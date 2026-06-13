import { config } from "dotenv";

// Load env BEFORE importing anything that reads it (lib/db opens the Neon
// connection at module load, so we dynamic-import it after config()).
config({ path: ".env.local" });

/**
 * Mint an API key from the CLI (before the dashboard OAuth UI exists):
 *   npm run key:create -- --account "Acme Inc" [--label "cursor laptop"]
 *
 * Finds or creates the named account, mints a key, and prints the raw key ONCE.
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const name = arg("account");
  if (!name) {
    console.error('Usage: npm run key:create -- --account "<name>" [--label "<label>"]');
    process.exit(1);
  }
  const label = arg("label") ?? null;

  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { accounts } = await import("@/lib/db/schema");
  const { mintApiKey } = await import("@/lib/auth/api-key");

  let account = await db.query.accounts.findFirst({ where: eq(accounts.name, name) });
  if (!account) {
    [account] = await db.insert(accounts).values({ name }).returning();
    console.log(`Created account "${name}" (${account.id})`);
  } else {
    console.log(`Using existing account "${name}" (${account.id})`);
  }

  const { raw, record } = await mintApiKey(account.id, label);

  console.log("\n  API key (shown once — store it now):\n");
  console.log(`    ${raw}\n`);
  console.log(`  prefix: ${record.prefix}   label: ${record.label ?? "(none)"}`);
  console.log("\n  Use as:  Authorization: Bearer <key>   (or ERVIN_API_KEY for the stdio client)\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
