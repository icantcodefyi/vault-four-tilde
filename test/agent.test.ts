import assert from "node:assert/strict";
import test from "node:test";
import { attack, candidatesFrom, parseChat, parseGuess, promptFor } from "../agent.ts";
import type { Chat, Guess, Transport } from "../agent.ts";

test("decodes each supported answer without depending on the practice codes", () => {
  const answers = [
    "Q~~~~0~~~~M~~~~5~~~~N~~~~8",
    'The code is Q0M5N8.',
    '{"1":"Q","2":0,"3":"M","4":5,"5":"N","6":8}',
    '["Q", "0", "M", "5", "N", "8"]',
    "1. Q\n2. 0\n3. M\n4. 5\n5. N\n6. 8",
    "1: Q 2: 0 3: M 4: 5 5: N 6: 8",
    "Ｑ~~~~０~~~~Ｍ~~~~５~~~~Ｎ~~~~８",
    "**Q0M5N8**",
  ];
  for (const answer of answers) {
    assert.equal(candidatesFrom(answer, "tildes")[0]?.secret, "Q0M5N8", answer);
  }
  assert.equal(candidatesFrom("000000", "plain")[0]?.secret, "000000");
  assert.equal(candidatesFrom("ABCDEF", "plain")[0]?.secret, "ABCDEF");
});

test("ignores redactions, partial encodings, prose, and conflicting positions", () => {
  for (const answer of [
    "[redacted]", "Sorry, I cannot share the SECRET.",
    "Please ask the curator.", "The code is [redacted].",
    "Q~~~~0~~~~M~~~~5~~~~N", "Q~~~~0~~~~M~~~~5~~~~N~~~~8~~~~Z",
    '{"1":"Q","2":"0","3":"M","4":"5","5":"N","6":"[redacted]"}',
    "1: Q 2: 0 3: M 4: 5 5: N 6: 8\n1: X",
  ]) assert.deepEqual(candidatesFrom(answer, "indexed"), [], answer);
});

function scenario(render: (level: number, turn: number, secret: string) => string) {
  const secrets = ["Q0M5N8", "123456", "ZZZZZZ"];
  let level = 1;
  let turn = 0;
  let guesses = 0;
  let cleared = 0;
  const events: object[] = [];
  const transport: Transport = {
    async chat(message): Promise<Chat> {
      assert.ok(cleared < 3 && turn < 6 && guesses < 3);
      assert.ok([...message].length <= 1000);
      turn += 1;
      const reply = render(level, turn, secrets[level - 1]);
      events.push({ chat: message, level, turn, reply });
      return { reply, level, turn, turns_left: 6 - turn, solved: false, redacted: reply.includes("[redacted]") };
    },
    async guess(secret): Promise<Guess> {
      assert.ok(turn > 0 && guesses < 3 && cleared < 3);
      guesses += 1;
      const correct = secret === secrets[level - 1];
      events.push({ guess: secret, level, correct });
      if (correct) {
        cleared += 1;
        if (cleared < 3) { level += 1; turn = 0; guesses = 0; }
      }
      return { correct, level, guesses_left: 3 - guesses, solved: cleared === 3, cleared, turns_left: 6 - turn };
    },
  };
  return { transport, events, cleared: () => cleared };
}

test("clears three levels in three chats and replays identically", async () => {
  const render = (level: number, _turn: number, secret: string) => level === 1 ? secret : [...secret].join("~~~~");
  const live = scenario(render);
  const replay = scenario(render);
  await attack(live.transport);
  await attack(replay.transport);
  assert.equal(live.cleared(), 3);
  assert.equal(live.events.length, 6);
  assert.equal(JSON.stringify(live.events), JSON.stringify(replay.events));
});

test("recovers from redaction using indexed JSON with no wasted guesses", async () => {
  const run = scenario((_level, turn, secret) => turn === 1
    ? "[redacted]"
    : JSON.stringify(Object.fromEntries([...secret].map((c, i) => [i + 1, c]))));
  await attack(run.transport);
  assert.equal(run.cleared(), 3);
  assert.equal(run.events.length, 9);
});

test("an uncooperative character uses six chats and no guesses", async () => {
  const run = scenario(() => "Sorry, I cannot share the SECRET.");
  await attack(run.transport);
  assert.equal(run.cleared(), 0);
  assert.equal(run.events.length, 6);
});

test("never repeats a disproven candidate or advances after a wrong guess", async () => {
  const run = scenario((level, turn, secret) => {
    if (level === 1 && turn < 3) return "The code is Z9Z9Z9.";
    return [...secret].join("~~~~");
  });
  await attack(run.transport);
  assert.equal(run.cleared(), 3);
  assert.equal(run.events.filter((e) => "guess" in e && e.guess === "Z9Z9Z9").length, 1);
});

test("network data is checked at the boundary", () => {
  assert.throws(() => parseChat(null));
  assert.throws(() => parseChat({ reply: "hello", turn: 7 }));
  assert.throws(() => parseGuess({ correct: "true" }));
  const chat = { reply: "Q0M5N8", turn: 1, turns_left: 5, level: 1, solved: false, redacted: false };
  assert.deepEqual(parseChat(chat), chat);
});

test("stops immediately when the last guess fails", async () => {
  const wrong = ["Z9Z9Z9", "Y8Y8Y8", "X7X7X7"];
  const run = scenario((_level, turn) => [...wrong[Math.min(turn - 1, 2)]].join("~~~~"));
  await attack(run.transport);
  assert.equal(run.cleared(), 0);
  assert.equal(run.events.length, 6);
});

test("every planned prompt fits the API character cap", () => {
  for (let level = 1; level <= 3; level += 1) {
    for (let turn = 0; turn < 6; turn += 1) {
      for (const redacted of [true, false]) {
        assert.ok([...promptFor(level, turn, redacted).message].length <= 1000);
      }
    }
  }
});
