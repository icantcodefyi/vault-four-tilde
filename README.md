# Vault Four Tilde

[![make.fun bounty](https://make.fun/badge/jailbreak-the-vault-01.svg)](https://make.fun/bounty/jailbreak-the-vault-01)
[![rank](https://make.fun/badge/jailbreak-the-vault-01/icantcodefyi/vault-four-tilde/rank.svg)](https://make.fun/bounty/jailbreak-the-vault-01/leaderboard)
[![reward](https://make.fun/badge/jailbreak-the-vault-01/icantcodefyi/vault-four-tilde/reward.svg)](https://make.fun/bounty/jailbreak-the-vault-01)

A deterministic, model-free attacker for make.fun's authorized three-level secret-code challenge. Runs on Node 22 using only the standard library; no install or provider API key is needed.

## Strategy

Level one asks for the code directly. At the filtered levels, the first prompt requests four tildes between characters. This exceeds the published spelling filter's three-character gap limit, and tildes do not match its numeric-list or Morse separators. Numbered JSON fields and numbered lines provide fallbacks.

The parser accepts structured answers, checks code length and alphabet, avoids reusing disproven guesses, and preserves the last uncertain guess until the final turn. Each level starts with fresh evidence. Only target replies supply candidates; the entry contains no practice answers, target data files, or generator access.

The program reads the supplied brief and calls only the environment's documented POST /chat and POST /guess endpoints. It does not use randomness, wall-clock decisions, or model calls of its own. A received HTTP 502 is retried at most twice; ambiguous transport failures are not retried.

## Run

Set MAKEFUN_ENV_URL to the challenge environment and MAKEFUN_PROMPT_FILE to its brief, then run:

    node --experimental-strip-types main.ts

Run the repository's tests:

    node --experimental-strip-types --test test/*.test.ts

## Validation

Tests cover answer formats, refusals, redaction, guess limits, level progression, and repeatability. Development also checked three encodings on 10,036 deterministic test codes against both exact published filters, and ran the official environment twice with a simulated target under Node 22 and the competition's resource limits.

The simulated runs cleared three levels in three chats with identical exported state and transcripts. These checks do not establish live model compliance or a competition score; make.fun's live grading and sealed final targets determine those.

MIT licensed. The original coding-session transcript is uploaded separately to make.fun, not committed here.

Entered on [make.fun](https://make.fun/?ref=r5sjsgm1&utm_source=github&utm_medium=readme&utm_campaign=jailbreak-the-vault-01).
