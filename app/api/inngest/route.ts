import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { chatIntake } from "@/lib/inngest/functions/chat-intake";
import { runStateMachine } from "@/lib/inngest/functions/run-state-machine";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runStateMachine, chatIntake],
});
