import { z } from "zod";

export const askSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(2000, "Prompt too long"),
  conversationId: z.string().uuid().optional(),
});

export const compareSchema = z.object({
  symbols: z
    .array(z.string().min(1).max(12))
    .min(2, "Pick at least 2 symbols")
    .max(3, "Compare at most 3 symbols at once"),
  conversationId: z.string().uuid().optional(),
});
