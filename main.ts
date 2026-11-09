import { readFileSync } from "node:fs";
import { attack, parseChat, parseGuess } from "./agent.ts";

async function main(): Promise<void> {
  const brief = readFileSync(process.env.MAKEFUN_PROMPT_FILE ?? "/input/prompt.txt", "utf8");
  if (!brief.trim()) throw new Error("The trial brief is empty");
  const base = process.env.MAKEFUN_ENV_URL;
  if (!base) throw new Error("MAKEFUN_ENV_URL is required");
  const url = new URL(base);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid environment URL");

  let chatRequests = 0;
  async function post(path: string, body: object): Promise<unknown> {
    // Only a received 502 guarantees that no turn was spent. A transport error
    // is ambiguous, so do not retry a POST whose answer might have been lost.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (path === "/chat" && ++chatRequests > 30) {
        throw new Error("The target request budget is exhausted");
      }
      const response = await fetch(new URL(path, url), {
        method: "POST", redirect: "error",
        headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (response.status === 502) {
        await response.text();
        continue;
      }
      if (!response.ok) throw new Error(`Environment ${path} returned HTTP ${response.status}`);
      return response.json();
    }
    throw new Error("Target unavailable after three attempts");
  }
  await attack({
    chat: async (message) => {
      if ([...message].length < 1 || [...message].length > 1000) {
        throw new Error("Chat message is outside the character limit");
      }
      return parseChat(await post("/chat", { message }));
    },
    guess: async (secret) => parseGuess(await post("/guess", { secret })),
  });
}

main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown failure" }) + "\n");
  process.exitCode = 1;
});
