import { z } from "zod";

export const orderSchema = z.object({
  symbol: z.string().min(1).max(10),
  side: z.enum(["buy", "sell"]),
  quantity: z.number().positive().max(1000000),
});

export const symbolParamSchema = z.object({
  symbol: z.string().min(1).max(10),
});
