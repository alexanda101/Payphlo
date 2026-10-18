"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "../../lib/api";
import { AppShell } from "../components/AppShell";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocked?: boolean;
};

type AssetLite = { symbol: string; name: string };
type ConversationSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_SUGGESTIONS = [
  "What should beginners know before investing $500?",
  "Why do transfer amounts change?",
  "Why spread money across different investments?",
  "Why do crypto prices change so quickly?",
];

export default function AssistantPage() {
  return (
    <Suspense fallback={<AssistantFallback />}>
      <AssistantContent />
    </Suspense>
  );
}

function AssistantContent() {
  const router = useRouter();
  const search = useSearchParams();
  const prefill = search?.get("prefill") || "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(prefill);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compare modal state
  const [compareOpen, setCompareOpen] = useState(false);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const redirectIfUnauthorized = useCallback(
    (err: unknown) => {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        router.push("/login");
        return true;
      }
      return false;
    },
    [router]
  );

  const refreshConversations = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.listConversations();
      setConversations(res.conversations);
    } catch (err) {
      if (!redirectIfUnauthorized(err)) setError((err as ApiError).message);
    } finally {
      setHistoryLoading(false);
    }
  }, [redirectIfUnauthorized]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    async function loadUsageSuggestions() {
      const [portfolioResult, watchlistResult, transfersResult] =
        await Promise.allSettled([
          api.portfolio(),
          api.watchlist(),
          api.listTransfers(),
        ]);

      setSuggestions(
        buildUsageSuggestions({
          portfolio:
            portfolioResult.status === "fulfilled" ? portfolioResult.value : null,
          watchlist:
            watchlistResult.status === "fulfilled"
              ? watchlistResult.value.watchlist
              : [],
          transfers:
            transfersResult.status === "fulfilled"
              ? transfersResult.value.transfers
              : [],
        })
      );
    }

    void loadUsageSuggestions();
  }, []);

  useEffect(() => {
    setInput(prefill);
  }, [prefill]);

  async function openConversation(id: string) {
    if (loading || comparing) return;
    setError(null);

    try {
      const res = await api.getConversation(id);
      setConversationId(res.conversation.id);
      setMessages(
        res.conversation.messages.flatMap((m) => {
          if (m.role === "system") return [];

          return [{
            id: m.id,
            role: m.role,
            content: m.content,
            blocked: m.blocked,
          }];
        })
      );
    } catch (err) {
      if (!redirectIfUnauthorized(err)) setError((err as ApiError).message);
    }
  }

  function startNewChat() {
    setConversationId(undefined);
    setMessages([]);
    setInput(prefill);
    setError(null);
  }

  async function deleteSavedConversation(id: string) {
    if (deletingConversationId || clearingHistory) return;

    setDeletingConversationId(id);
    setError(null);
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((conversation) => conversation.id !== id));

      if (conversationId === id) {
        startNewChat();
      }
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setDeletingConversationId(null);
    }
  }

  async function clearSavedConversations() {
    if (clearingHistory || conversations.length === 0) return;
    if (!window.confirm("Clear all saved Phlo chats?")) return;

    setClearingHistory(true);
    setError(null);
    try {
      await api.clearConversations();
      setConversations([]);
      startNewChat();
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setClearingHistory(false);
    }
  }

  function handleApiFailure(err: unknown) {
    if (!redirectIfUnauthorized(err)) setError((err as ApiError).message);
  }

  function historyLabel(conversation: ConversationSummary) {
    return conversation.title || "Untitled chat";
  }

  function historyDate(iso: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, comparing]);

  // Lazy-load assets when the user opens the compare modal.
  useEffect(() => {
    if (!compareOpen || assets.length) return;
    api
      .assets()
      .then((r) =>
        setAssets(r.assets.map((a) => ({ symbol: a.symbol, name: a.name })))
      )
      .catch(() => {});
  }, [compareOpen, assets.length]);

  async function send(prompt: string) {
    if (!prompt.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: prompt,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await api.ask(prompt, conversationId);
      setConversationId(res.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: res.message.id,
          role: "assistant",
          content: res.message.content,
          blocked: res.blocked,
        },
      ]);
      void refreshConversations();
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setLoading(false);
    }
  }

  async function runCompare() {
    if (picked.length < 2 || comparing) return;
    setComparing(true);
    setError(null);
    setCompareOpen(false);

    const userPrompt = `Compare ${picked.join(" vs ")}`;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: userPrompt },
    ]);

    try {
      const res = await api.compareAssets(picked, conversationId);
      setConversationId(res.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: res.message.id,
          role: "assistant",
          content: res.message.content,
        },
      ]);
      setPicked([]);
      void refreshConversations();
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setComparing(false);
    }
  }

  function togglePick(symbol: string) {
    setPicked((prev) => {
      if (prev.includes(symbol)) return prev.filter((s) => s !== symbol);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, symbol];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <AppShell>
      <div className="grid h-[calc(100dvh-106px)] min-h-0 grid-cols-1 md:h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:border-b-0 lg:border-r lg:py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Chats
              </p>
              <p className="text-sm font-medium">History</p>
            </div>
            <div className="flex items-center gap-2">
              {conversations.length > 0 && (
                <button
                  onClick={clearSavedConversations}
                  disabled={clearingHistory}
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--negative)]/50 hover:text-[var(--negative)] disabled:opacity-50"
                >
                  {clearingHistory ? "Clearing" : "Clear"}
                </button>
              )}
              <button onClick={startNewChat} className="btn-ghost px-3 py-1.5 text-xs">
                New
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-[calc(100vh-130px)] lg:space-y-1 lg:overflow-y-auto lg:pb-0">
            {historyLoading && conversations.length === 0 && (
              <p className="min-w-44 text-xs text-[var(--muted)]">Loading chats...</p>
            )}

            {!historyLoading && conversations.length === 0 && (
              <p className="min-w-44 text-xs text-[var(--muted)]">
                No saved chats yet.
              </p>
            )}

            {conversations.map((conversation) => {
              const active = conversation.id === conversationId;
              return (
                <div
                  key={conversation.id}
                  className={`group flex min-w-56 items-start gap-2 rounded-lg border px-3 py-2 text-left transition lg:w-full lg:min-w-0 ${
                    active
                      ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]/40 hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <button
                    onClick={() => openConversation(conversation.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {historyLabel(conversation)}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                      {historyDate(conversation.updatedAt)}
                    </span>
                  </button>
                  <button
                    onClick={() => deleteSavedConversation(conversation.id)}
                    disabled={deletingConversationId === conversation.id}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm text-[var(--muted-2)] opacity-100 transition hover:bg-[var(--negative)]/10 hover:text-[var(--negative)] disabled:opacity-40 lg:opacity-0 lg:group-hover:opacity-100"
                    title="Delete chat"
                    aria-label="Delete chat"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          <header className="border-b border-[var(--border)] px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm text-[var(--muted)]">Payphlo Guide</p>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Ask Phlo
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCompareOpen(true)}
                  className="btn-ghost text-xs"
                  disabled={comparing}
                >
                  Compare assets
                </button>
                <span className="pill pill-brand">Insights, not advice</span>
              </div>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--muted)]">Try one of these:</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="card p-4 text-left text-sm transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface-2)]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCompareOpen(true)}
                    className="card flex w-full items-center justify-between gap-3 p-4 text-left text-sm transition hover:border-[var(--brand)]/40 hover:bg-[var(--surface-2)]"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">Compare two or three assets</span>
                      <span className="block text-xs text-[var(--muted)]">
                        Side-by-side education on how they differ.
                      </span>
                    </span>
                    <span className="shrink-0 text-[var(--brand)]">⇄</span>
                  </button>
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[82%] ${
                      m.role === "user"
                        ? "bg-[var(--brand)] text-[#04130a]"
                        : m.blocked
                        ? "border border-[var(--warn)]/40 bg-[var(--warn)]/10 text-[var(--foreground)]"
                        : "card-2"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {(loading || comparing) && (
                <div className="flex justify-start">
                  <div className="card-2 px-4 py-2.5 text-sm text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Dot delay="0s" /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
                    </span>
                  </div>
                </div>
              )}

              {error && <p className="text-center text-sm text-[var(--negative)]">{error}</p>}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4"
          >
            <div className="mx-auto flex max-w-3xl gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Phlo about investing, transfers, risk, or market concepts…"
                className="input min-w-0 flex-1"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-brand shrink-0 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>

      {compareOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setCompareOpen(false)}
        >
          <div
            className="card w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Compare assets</h2>
              <button
                onClick={() => setCompareOpen(false)}
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Pick 2 or 3. Educational comparison — never picks a winner.
            </p>

            <div className="mt-4 max-h-72 space-y-1 overflow-y-auto pr-1">
              {assets.length === 0 && (
                <p className="text-sm text-[var(--muted)]">Loading assets…</p>
              )}
              {assets.map((a) => {
                const checked = picked.includes(a.symbol);
                const disabled = !checked && picked.length >= 3;
                return (
                  <button
                    key={a.symbol}
                    onClick={() => togglePick(a.symbol)}
                    disabled={disabled}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      checked
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--foreground)]"
                        : "border-[var(--border)] hover:border-[var(--brand)]/40 hover:bg-[var(--surface-2)]"
                    } ${disabled ? "opacity-40" : ""}`}
                  >
                    <span>
                      <span className="font-semibold">{a.symbol}</span>
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        {a.name}
                      </span>
                    </span>
                    <span
                      className={`text-xs ${
                        checked ? "text-[var(--brand)]" : "text-[var(--muted-2)]"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">
                {picked.length} / 3 selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCompareOpen(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={runCompare}
                  disabled={picked.length < 2}
                  className="btn-brand text-xs disabled:opacity-50"
                >
                  Compare
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function buildUsageSuggestions({
  portfolio,
  watchlist,
  transfers,
}: {
  portfolio: Awaited<ReturnType<typeof api.portfolio>> | null;
  watchlist: Awaited<ReturnType<typeof api.watchlist>>["watchlist"];
  transfers: Awaited<ReturnType<typeof api.listTransfers>>["transfers"];
}) {
  const prompts: string[] = [];
  const positions = portfolio?.positions || [];
  const latestTransfer = transfers[0];

  if (latestTransfer) {
    prompts.push(
      `Why do ${latestTransfer.quote.fromCurrency}-${latestTransfer.quote.toCurrency} transfer costs and delivery times change?`
    );
  } else {
    prompts.push("Why do transfer amounts change?");
  }

  if (positions.length === 0) {
    prompts.push("How can practice investing help beginners learn without real money?");
  } else if (positions.length === 1) {
    prompts.push("What are the risks of having most of my money in one investment?");
  } else {
    prompts.push("Why spread money across different investments?");
  }

  if (positions.some((position) => position.assetClass === "crypto")) {
    prompts.push("Why do crypto prices change so quickly?");
  }

  if (positions.some((position) => position.assetClass === "etf")) {
    prompts.push("How can ETFs spread risk compared with buying one company?");
  }

  if (watchlist.length >= 2) {
    prompts.push("What simple questions help compare my watchlist?");
  } else if (watchlist.length === 1) {
    prompts.push(`What should I learn while researching ${watchlist[0].symbol}?`);
  }

  prompts.push(...DEFAULT_SUGGESTIONS);

  return Array.from(new Set(prompts)).slice(0, 4);
}

function AssistantFallback() {
  return (
    <AppShell>
      <div className="grid h-[calc(100dvh-106px)] place-items-center md:h-screen">
        <p className="text-sm text-[var(--muted)]">Loading Phlo…</p>
      </div>
    </AppShell>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)]"
      style={{ animationDelay: delay }}
    />
  );
}
