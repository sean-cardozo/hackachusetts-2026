"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AskContext } from "@/lib/data";

const SUGGESTIONS = [
  "Why is my atorvastatin cost high?",
  "What runs out first?",
  "Why did you recommend Supplier B?",
] as const;

type Answer = {
  answer: string;
  sources: string[];
  note: string;
};

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; data: Answer }
  | { id: number; role: "error"; text: string; question: string };

type AskResponse = {
  result?: { answer?: string; sources?: string[] };
  source?: "ai" | "fallback";
};

export default function AskPanel({ context }: { context: AskContext }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      buttonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const ask = useCallback(
    async (question: string, replaceErrorId?: number) => {
      const q = question.trim();
      if (!q || busy) return;
      setBusy(true);
      setMessages((m) => {
        const base = replaceErrorId ? m.filter((x) => x.id !== replaceErrorId) : m;
        return replaceErrorId ? base : [...base, { id: nextId.current++, role: "user", text: q }];
      });
      try {
        const res = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, context }),
        });
        if (!res.ok) {
          const msg =
            res.status === 400
              ? "That question could not be read. Try shorter wording (under 500 characters)."
              : "Something went wrong getting an answer.";
          setMessages((m) => [...m, { id: nextId.current++, role: "error", text: msg, question: q }]);
          return;
        }
        const body = (await res.json()) as AskResponse;
        const answer = body.result?.answer;
        if (!answer) throw new Error("empty");
        setMessages((m) => [
          ...m,
          {
            id: nextId.current++,
            role: "assistant",
            data: {
              answer,
              sources: body.result?.sources ?? [],
              note: body.source === "ai" ? "AI" : "Rule-based",
            },
          },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: nextId.current++,
            role: "error",
            text: "We could not reach the server. Check your connection and try again.",
            question: q,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, context],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input;
    if (!q.trim()) return;
    setInput("");
    void ask(q);
  };

  return (
    <>
      {!open ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="btn btn-primary fixed bottom-5 right-5 z-50"
        >
          Ask PharmaPool
        </button>
      ) : null}
      {open ? (
        <div
          role="dialog"
          aria-label="Ask PharmaPool"
          className="fixed bottom-0 right-0 z-50 flex h-[600px] max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-[18px] border-2 border-ink bg-surface shadow-pp sm:bottom-5 sm:right-5 sm:w-[390px] sm:rounded-[18px]"
        >
          <div className="flex items-center justify-between border-b-[1.5px] border-line px-4 py-3">
            <h2 className="m-0 font-display text-[20px] uppercase tracking-[0.03em]">Ask PharmaPool</h2>
            <button type="button" onClick={close} className="btn btn-secondary btn-sm" aria-label="Close">
              Close
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            <div aria-live="polite" className="flex flex-col gap-3">
              {messages.length === 0 ? (
                <p className="m-0 text-[13.5px] text-muted">
                  Ask about your costs, supply risk or supplier picks. Answers use only the data in this app.
                </p>
              ) : null}
              {messages.map((m) =>
                m.role === "user" ? (
                  <div
                    key={m.id}
                    className="max-w-[85%] self-end rounded-[14px] bg-accent-soft px-3 py-2 text-[14px] font-semibold"
                  >
                    {m.text}
                  </div>
                ) : m.role === "assistant" ? (
                  <div key={m.id} className="max-w-[95%] self-start rounded-[14px] border-[1.5px] border-line px-3 py-2">
                    <p className="m-0 text-[14px]">{m.data.answer}</p>
                    {m.data.sources.length > 0 ? (
                      <p className="mb-0 mt-2 text-[12px] text-muted">Sources: {m.data.sources.join("; ")}</p>
                    ) : null}
                    <p className="mb-0 mt-1 text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted">
                      {m.data.note}
                    </p>
                  </div>
                ) : (
                  <div
                    key={m.id}
                    role="alert"
                    className="self-start rounded-[14px] border-[1.5px] border-bad bg-bad-soft px-3 py-2"
                  >
                    <p className="m-0 text-[13.5px] font-bold text-bad">{m.text}</p>
                    <button
                      type="button"
                      className="btn btn-strong btn-sm mt-2"
                      disabled={busy}
                      onClick={() => void ask(m.question, m.id)}
                    >
                      Try again
                    </button>
                  </div>
                ),
              )}
              {busy ? <p className="m-0 text-[13px] text-muted">Thinking…</p> : null}
            </div>
          </div>

          <div className="border-t-[1.5px] border-line px-4 pt-3">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(s)}
                  className="btn btn-secondary btn-sm"
                >
                  {s}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="flex gap-2 py-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                aria-label="Your question"
                placeholder="Ask a question"
                className="min-w-0 flex-1 rounded-full border-[1.5px] border-line-strong bg-surface px-4 py-2 text-[14px]"
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !input.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
