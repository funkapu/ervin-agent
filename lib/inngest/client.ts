import type { ChatSource } from "@/lib/chat/source";
import { Inngest } from "inngest";

/**
 * Shared Inngest client for Ervin. Functions register against this client and
 * the `/api/inngest` route serves them.
 */
export const inngest = new Inngest({ id: "ervin" });

/** Event names used across the engine. */
export const EVENTS = {
  runCreated: "run/created",
  runApproved: "run/approved",
  chatIntake: "chat/intake",
} as const;

/** Payload shapes for our events (event.data is `any` at the SDK boundary). */
export type RunCreatedData = { runId: string };
export type RunApprovedData = { runId: string };

/** A raw chat message to parse into actionable work (provider-agnostic). */
export type ChatIntakeData = {
  source: ChatSource;
  text: string;
  user: string;
};
