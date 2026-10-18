import { z } from "zod";

export const quoteSchema = z.object({
  corridorCode: z.string().min(3),
  sendAmount: z.number().positive().max(50000),
  speedTier: z.enum(["economy", "standard", "express"]),
});

export const confirmSchema = z.object({
  quoteId: z.string().uuid(),
  recipientName: z.string().min(1).max(120),
});
