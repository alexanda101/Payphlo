const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const CSRF_COOKIE_NAME = "payphlo_csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let csrfRequest: Promise<string> | null = null;

export type ApiError = {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!SAFE_METHODS.has(method)) {
    headers[CSRF_HEADER_NAME] = await getCsrfToken();
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err: ApiError = {
      message: data.message || "Request failed",
      status: res.status,
      errors: data.errors,
    };
    throw err;
  }

  return data as T;
}

async function getCsrfToken() {
  const existingToken = readCookie(CSRF_COOKIE_NAME);
  if (existingToken) return existingToken;

  if (!csrfRequest) {
    csrfRequest = fetch(`${API_URL}/auth/csrf`, {
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.csrfToken) {
          throw new Error(data.message || "Unable to prepare request");
        }
        return data.csrfToken as string;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }

  return csrfRequest;
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export const api = {
  signup: (name: string, email: string, password: string) =>
    request<{ message: string; user: { id: string; name: string | null; email: string } }>(
      "/auth/signup",
      { method: "POST", body: JSON.stringify({ name, email, password }) }
    ),

  login: (email: string, password: string) =>
    request<{
      message: string;
      user: { id: string; name: string | null; email: string };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
    }),

  me: () =>
    request<{ user: { id: string; name: string | null; email: string; createdAt: string } }>(
      "/auth/me"
    ),

  ask: (prompt: string, conversationId?: string) =>
    request<{
      conversationId: string;
      blocked: boolean;
      intent?: string;
      source?: "llm" | "fallback";
      provider?: "openai" | "mistral" | "anthropic" | "none";
      model?: string | null;
      message: {
        id: string;
        role: "assistant";
        content: string;
        createdAt: string;
      };
    }>("/assistant/ask", {
      method: "POST",
      body: JSON.stringify({ prompt, conversationId }),
    }),

  compareAssets: (symbols: string[], conversationId?: string) =>
    request<{
      conversationId: string;
      blocked: boolean;
      intent: string;
      source: "llm" | "fallback";
      provider: "openai" | "mistral" | "anthropic" | "none";
      model: string | null;
      userPrompt: string;
      message: {
        id: string;
        role: "assistant";
        content: string;
        createdAt: string;
      };
    }>("/assistant/compare", {
      method: "POST",
      body: JSON.stringify({ symbols, conversationId }),
    }),

  listConversations: () =>
    request<{
      conversations: {
        id: string;
        title: string | null;
        createdAt: string;
        updatedAt: string;
      }[];
    }>("/assistant/conversations"),

  getConversation: (id: string) =>
    request<{
      conversation: {
        id: string;
        title: string | null;
        messages: {
          id: string;
          role: "user" | "assistant" | "system";
          content: string;
          blocked: boolean;
          createdAt: string;
        }[];
      };
    }>(`/assistant/conversations/${id}`),

  deleteConversation: (id: string) =>
    request<{ ok: true }>(`/assistant/conversations/${id}`, {
      method: "DELETE",
    }),

  clearConversations: () =>
    request<{ ok: true; deletedCount: number }>("/assistant/conversations", {
      method: "DELETE",
    }),

  corridors: () =>
    request<{
      corridors: {
        code: string;
        fromCurrency: string;
        toCurrency: string;
        fromCountry: string;
        toCountry: string;
        flag: string;
        symbol: string;
        midMarketRate: number;
        baseMarkupPct: number;
        health: "good" | "average" | "poor";
        healthNote: string;
      }[];
      speedTiers: {
        code: "economy" | "standard" | "express";
        label: string;
        description: string;
        etaMinMin: number;
        etaMaxMin: number;
      }[];
    }>("/transfers/corridors"),

  quote: (
    corridorCode: string,
    sendAmount: number,
    speedTier: "economy" | "standard" | "express"
  ) =>
    request<{
      quote: {
        id: string;
        corridor: string;
        fromCurrency: string;
        toCurrency: string;
        sendAmount: number;
        midMarketRate: number;
        ourRate: number;
        markupPct: number;
        feeAmount: number;
        totalCost: number;
        receiveAmount: number;
        fxMarkupCost: number;
        speedTier: string;
        deliveryEtaMin: number;
        deliveryEtaMax: number;
        expiresAtIso: string;
      };
    }>("/transfers/quote", {
      method: "POST",
      body: JSON.stringify({ corridorCode, sendAmount, speedTier }),
    }),

  confirmTransfer: (quoteId: string, recipientName: string) =>
    request<{
      transfer: {
        id: string;
        status: string;
        recipientName: string;
        createdAt: string;
        quote: {
          fromCurrency: string;
          toCurrency: string;
          sendAmount: number;
          receiveAmount: number;
        };
      };
    }>("/transfers/confirm", {
      method: "POST",
      body: JSON.stringify({ quoteId, recipientName }),
    }),

  listTransfers: () =>
    request<{
      transfers: {
        id: string;
        status: string;
        recipientName: string;
        createdAt: string;
        quote: {
          fromCurrency: string;
          toCurrency: string;
          sendAmount: number;
          receiveAmount: number;
        };
      }[];
    }>("/transfers"),

  // -------- Investing --------
  assets: () =>
    request<{
      assets: {
        id: string;
        symbol: string;
        name: string;
        assetClass: "stock" | "etf" | "crypto";
        sector: string | null;
        riskLevel: "low" | "medium" | "high";
        description: string | null;
        price: number;
        changeAbs: number;
        changePct: number;
        history: number[];
      }[];
    }>("/investing/assets"),

  assetDetail: (symbol: string) =>
    request<{
      asset: {
        symbol: string;
        name: string;
        assetClass: string;
        sector: string | null;
        riskLevel: string;
        description: string | null;
        price: number;
        changeAbs: number;
        changePct: number;
        history: number[];
      };
    }>(`/investing/assets/${symbol}`),

  watchlist: () =>
    request<{
      watchlist: {
        symbol: string;
        name: string;
        assetClass: string;
        riskLevel: string;
        price: number;
        changeAbs: number;
        changePct: number;
      }[];
    }>("/investing/watchlist"),

  addWatch: (symbol: string) =>
    request<{ ok: true }>(`/investing/watchlist/${symbol}`, { method: "POST" }),

  removeWatch: (symbol: string) =>
    request<{ ok: true }>(`/investing/watchlist/${symbol}`, { method: "DELETE" }),

  portfolio: () =>
    request<{
      cashBalance: number;
      positionsValue: number;
      totalValue: number;
      positions: {
        symbol: string;
        name: string;
        assetClass: string;
        quantity: number;
        avgCost: number;
        price: number;
        marketValue: number;
        costBasis: number;
        unrealizedPnL: number;
        unrealizedPnLPct: number;
      }[];
    }>("/investing/portfolio"),

  placeOrder: (symbol: string, side: "buy" | "sell", quantity: number) =>
    request<{
      order: { id: string; side: string; quantity: number; price: number; total: number };
      executedPrice: number;
      total: number;
    }>("/investing/orders", {
      method: "POST",
      body: JSON.stringify({ symbol, side, quantity }),
    }),

  orderHistory: () =>
    request<{
      orders: {
        id: string;
        symbol: string;
        name: string;
        side: "buy" | "sell";
        quantity: number;
        price: number;
        total: number;
        status: string;
        createdAt: string;
      }[];
    }>("/investing/orders"),
};
