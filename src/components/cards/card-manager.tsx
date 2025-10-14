"use client";

import {
  useState,
  FormEvent,
  useCallback,
  useEffect,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { getDb, type PerksKeeperDB } from "@/lib/db";
import { type Card, type CardIssuer } from "@/lib/types";

const ISSUER_OPTIONS: CardIssuer[] = ["Chase", "Amex", "Citi", "Other"];

const issuerBadgeClasses: Record<CardIssuer, string> = {
  Chase: "bg-blue-100 text-blue-700",
  Amex: "bg-violet-100 text-violet-700",
  Citi: "bg-cyan-100 text-cyan-700",
  Other: "bg-slate-100 text-slate-700",
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

interface FormState {
  issuer: CardIssuer;
  name: string;
}

export function CardManager() {
  const [db, setDb] = useState<PerksKeeperDB | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDb(getDb());
  }, []);

  const cards =
    useLiveQuery(
      async () => {
        if (!db) return [] as Card[];
        return db.cards.orderBy("createdAt").reverse().toArray();
      },
      [db],
      [] as Card[],
    ) ?? [];

  const [form, setForm] = useState<FormState>({ issuer: "Chase", name: "" });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const updateForm = useCallback(
    (field: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setError(null);
      setStatus(null);
    },
    [],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = form.name.trim();

    if (!trimmedName) {
      setError("Card name is required.");
      return;
    }

    if (!db) return;

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const now = Date.now();
      const card: Card = {
        id: crypto.randomUUID(),
        issuer: form.issuer,
        name: trimmedName,
        createdAt: now,
        updatedAt: now,
      };

      await db.cards.add(card);
      setForm((prev) => ({ ...prev, name: "" }));
      setStatus("Card saved.");
    } catch (saveError) {
      console.error(saveError);
      setError("Unable to save the card. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!db) return;

    const confirmDelete = window.confirm(
      "Removing this card will also remove its offers later. Continue?",
    );
    if (!confirmDelete) return;

    setDeletingId(cardId);

    try {
      await db.cards.delete(cardId);
      setStatus("Card removed.");
      setError(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError("Unable to remove the card. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">
            Add a new card
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Store your credit cards so you can link offers to them later.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Issuer
              <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={form.issuer}
                onChange={(event) =>
                  updateForm("issuer", event.target.value as CardIssuer)
                }
              >
                {ISSUER_OPTIONS.map((issuer) => (
                  <option key={issuer} value={issuer}>
                    {issuer}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Card name
              <input
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="e.g., Sapphire Preferred"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                maxLength={80}
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400"
              disabled={isSaving || !db}
            >
              {isSaving ? "Saving…" : "Save card"}
            </button>
            {status ? (
              <span className="text-sm text-green-600">{status}</span>
            ) : null}
            {error ? (
              <span className="text-sm text-red-600">{error}</span>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Your cards
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {cards.length
                ? "Edit or remove cards as your wallet changes."
                : "No cards yet. Add your first card to get started."}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {cards.length} {cards.length === 1 ? "card" : "cards"}
          </span>
        </div>

        <div className="mt-6">
          {cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm text-slate-500">
                Once you add a card, you&apos;ll see it listed here with quick
                controls.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {cards.map((card) => (
                <li
                  key={card.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm"
                >
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${issuerBadgeClasses[card.issuer]}`}
                    >
                      {card.issuer}
                    </span>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      {card.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Added {dateFormatter.format(card.createdAt)}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id)}
                      disabled={!db || deletingId === card.id}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-600 transition hover:border-red-200 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {deletingId === card.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
