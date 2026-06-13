import { createOpenRouter } from "@openrouter/ai-sdk-provider";

/**
 * Shared LLM access for Ervin.
 *
 * Models are routed through OpenRouter via the Vercel AI SDK. Model ids are
 * configurable through env so we can swap providers without touching code:
 *   - LLM_MODEL_PRIMARY   (default: DeepSeek V3.2)  — classification + code fixes
 *   - LLM_MODEL_SECONDARY (default: Kimi K2.6)      — cheaper / fallback work
 *
 * Requires OPENROUTER_API_KEY. Kept server-side only — never expose to the client.
 */
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const PRIMARY_MODEL_ID = process.env.LLM_MODEL_PRIMARY ?? "deepseek/deepseek-v3.2-exp";
const SECONDARY_MODEL_ID = process.env.LLM_MODEL_SECONDARY ?? "moonshotai/kimi-k2-thinking";

export const primaryModel = openrouter.chat(PRIMARY_MODEL_ID);
export const secondaryModel = openrouter.chat(SECONDARY_MODEL_ID);
