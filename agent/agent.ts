import { createAnthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

const anthropic = createAnthropic({
  baseURL: "https://token-plan-sgp.xiaomimimo.com/anthropic/v1",
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN,
});

export default defineAgent({
  model: anthropic("mimo-v2.5-pro"),
  modelContextWindowTokens: 200000,
});
