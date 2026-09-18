import { hashPassword } from "../src/services/auth.js";

// Usage: npm run admin:hash -- "your password"
// or:    echo "your password" | npm run admin:hash
async function readPassword(): Promise<string> {
  const fromArgs = process.argv[2];
  if (fromArgs) return fromArgs;

  if (process.stdin.isTTY) {
    console.error('Give a password: npm run admin:hash -- "your password"');
    process.exit(1);
  }

  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input.replace(/\r?\n$/, "");
}

const password = await readPassword();
if (password.length < 12) {
  console.error("Use at least 12 characters.");
  process.exit(1);
}

console.log(await hashPassword(password));
