import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const provider = createOpenAICompatible({
  name: "edgefn",
  baseURL: "https://api.edgefn.net/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

export default defineAgent({
  model: provider("GLM-5.2"),
  modelContextWindowTokens: 200000,
});
