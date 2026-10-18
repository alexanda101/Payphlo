import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { askSchema, compareSchema } from "../validators/assistant.validator";
import { checkGuardrails } from "../services/guardrails.service";
import {
  generateResponse,
  compareAssets,
  type AssistantContextMessage,
  type CompareAsset,
} from "../services/ai.service";
import { getAssetWithPrice } from "../services/investing.service";

export async function ask(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = askSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const { prompt, conversationId } = result.data;

    // Find or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: req.userId },
      });
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId: req.userId,
          title: prompt.slice(0, 60),
        },
      });
    }

    const recentMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { role: true, content: true },
    });
    const context: AssistantContextMessage[] = recentMessages
      .reverse()
      .map((m) => ({
        role: m.role as AssistantContextMessage["role"],
        content: m.content,
      }));

    // Guardrails
    const guard = checkGuardrails(prompt);

    // Save the user message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: prompt,
        blocked: guard.blocked,
      },
    });

    if (guard.blocked) {
      const blockedMsg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: guard.safeMessage,
          blocked: true,
        },
      });
      return res.json({
        conversationId: conversation.id,
        blocked: true,
        message: {
          id: blockedMsg.id,
          role: "assistant",
          content: guard.safeMessage,
          createdAt: blockedMsg.createdAt,
        },
      });
    }

    // Generate AI response
    const ai = await generateResponse(prompt, guard.warnings, context);

    const assistantMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: ai.content,
      },
    });

    return res.json({
      conversationId: conversation.id,
      blocked: false,
      intent: ai.intent,
      source: ai.source,
      provider: ai.provider,
      model: ai.model,
      message: {
        id: assistantMsg.id,
        role: "assistant",
        content: ai.content,
        createdAt: assistantMsg.createdAt,
      },
    });
  } catch (error) {
    console.error("[assistant.ask] error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function listConversations(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });

    return res.json({ conversations });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function getConversation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (typeof id !== "string") {
      return res.status(400).json({ message: "Invalid conversation id" });
    }
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: req.userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    return res.json({ conversation });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function deleteConversation(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (typeof id !== "string") {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const deleted = await prisma.conversation.deleteMany({
      where: { id, userId: req.userId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function clearConversations(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const deleted = await prisma.conversation.deleteMany({
      where: { userId: req.userId },
    });

    return res.json({ ok: true, deletedCount: deleted.count });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function compare(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const result = compareSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const { symbols, conversationId } = result.data;
    const upper = symbols.map((s) => s.toUpperCase());

    // Fetch each asset; surface a clean error if any are unknown.
    const fetched = await Promise.all(upper.map((s) => getAssetWithPrice(s)));
    const missing = upper.filter((_, i) => !fetched[i]);
    if (missing.length) {
      return res.status(404).json({
        message: `Unknown symbol(s): ${missing.join(", ")}`,
      });
    }

    const compareInput: CompareAsset[] = fetched.map((ap) => ({
      symbol: ap!.asset.symbol,
      name: ap!.asset.name,
      assetClass: ap!.asset.assetClass,
      sector: ap!.asset.sector,
      riskLevel: ap!.asset.riskLevel,
      price: ap!.price,
      changePct: ap!.change.changePct,
      description: ap!.asset.description,
    }));

    // Find or create conversation
    let conversation;
    const userPrompt = `Compare ${upper.join(" vs ")}`;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: req.userId },
      });
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: { userId: req.userId, title: userPrompt.slice(0, 60) },
      });
    }

    // Persist user-side prompt
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: userPrompt,
      },
    });

    const ai = await compareAssets(compareInput);

    const assistantMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: ai.content,
      },
    });

    return res.json({
      conversationId: conversation.id,
      blocked: false,
      intent: ai.intent,
      source: ai.source,
      provider: ai.provider,
      model: ai.model,
      userPrompt,
      message: {
        id: assistantMsg.id,
        role: "assistant",
        content: ai.content,
        createdAt: assistantMsg.createdAt,
      },
    });
  } catch (error) {
    console.error("[assistant.compare] error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}
