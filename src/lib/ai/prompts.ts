/**
 * Prompt registry. Each agent prompt is versioned in its own module so changes
 * are reviewable and AgentRun rows can record which version produced an output.
 * Add new versions alongside, never edit a shipped version in place.
 */
import { chatAgentV1 } from "@/prompts/chat-agent/v1";
import { gbpAuditV1 } from "@/prompts/gbp-agent/v1";
import { seoAgentV1 } from "@/prompts/seo-agent/v1";
import { marketingV1 } from "@/prompts/marketing-agent/v1";
import { assistantV1 } from "@/prompts/assistant/v1";

export const PROMPTS = {
  "chat-agent": { v1: chatAgentV1 },
  "gbp-agent": { v1: gbpAuditV1 },
  "seo-agent": { v1: seoAgentV1 },
  "marketing-agent": { v1: marketingV1 },
  assistant: { v1: assistantV1 },
} as const;

export type PromptKey = keyof typeof PROMPTS;

export function getPrompt(key: "chat-agent", version?: "v1"): typeof chatAgentV1;
export function getPrompt(key: "gbp-agent", version?: "v1"): typeof gbpAuditV1;
export function getPrompt(key: "seo-agent", version?: "v1"): typeof seoAgentV1;
export function getPrompt(key: "marketing-agent", version?: "v1"): typeof marketingV1;
export function getPrompt(key: "assistant", version?: "v1"): typeof assistantV1;
export function getPrompt(key: PromptKey, version: "v1" = "v1"): any {
  return PROMPTS[key][version];
}
