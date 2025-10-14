"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

import { getDb, type PerksKeeperDB } from "@/lib/db";
import { deleteOfferPermanently } from "@/lib/offer-actions";
import {
  computeOfferStats,
  normalizeOffer,
  sortOffersByExpiry,
} from "@/lib/offers";
import type {
  Card,
  Offer,
  OfferCategory,
  OfferStatus,
} from "@/lib/types";

const EMPTY_CARDS: Card[] = [];
const EMPTY_OFFERS: Offer[] = [];

const STATUS_FILTERS: Array<{ label: string; value: OfferStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Expired", value: "expired" },
  { label: "Maxed", value: "maxed" },
];

const CATEGORY_FILTERS: Array<{ label: string; value: OfferCategory | "all" }> =
  [
    { label: "All categories", value: "all" },
    { label: "Dining", value: "Dining" },
    { label: "Travel", value: "Travel" },
    { label: "Grocery", value: "Grocery" },
    { label: "Gas", value: "Gas" },
    { label: "Online", value: "Online" },
    { label: "Other", value: "Other" },
  ];

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hour12: true,
  timeZone: "America/Chicago",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatDate(timestamp: number | undefined) {
  if (!timestamp) return "—";
  return dateFormatter.format(timestamp);
}

function statusBadgeStyles(status: OfferStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "expired":
      return "bg-slate-200 text-slate-700";
    case "maxed":
      return "bg-purple-100 text-purple-700";
    case "archived":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-200 text-slate-700";
  }
}

function statusLabel(status: OfferStatus) {
  if (status === "archived") return "Archived";
  if (status === "expired") return "Expired";
  if (status === "maxed") return "Maxed";
  return "Active";
}

function cardOpacity(status: OfferStatus) {
  if (status === "archived" || status === "expired" || status === "maxed") {
    return "opacity-60";
  }
  return "";
}

export default function HistoryPage() {
  const [db, setDb] = useState<PerksKeeperDB | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDb(getDb());
  }, []);

  const cards =
    useLiveQuery(async () => {
      if (!db) return EMPTY_CARDS;
      return db.cards.orderBy("name").toArray();
    }, [db], EMPTY_CARDS) ?? EMPTY_CARDS;

  const offers =
    useLiveQuery(async () => {
      if (!db) return EMPTY_OFFERS;
      return db.offers.orderBy("updatedAt").reverse().toArray();
    }, [db], EMPTY_OFFERS) ?? EMPTY_OFFERS;

  const [statusFilter, setStatusFilter] = useState<OfferStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<OfferCategory | "all">(
    "all",
  );
  const [search, setSearch] = useState("");

  // Normalize offers so expired ones switch status automatically.
  useEffect(() => {
    if (!db || !offers.length) return;

    const updates = offers
      .map((offer) => {
        const normalized = normalizeOffer(offer);
        if (normalized.status !== offer.status) {
          return normalized;
        }
        return null;
      })
      .filter((offer): offer is Offer => offer !== null);

    if (!updates.length) return;

    void db.transaction("rw", db.offers, async () => {
      await Promise.all(updates.map((offer) => db.offers.put(offer)));
    });
  }, [offers, db]);

  const cardLookup = useMemo(() => {
    const map = new Map<string, Card>();
    cards.forEach((card) => map.set(card.id, card));
    return map;
  }, [cards]);

  const filteredOffers = useMemo(() => {
    const lowered = search.trim().toLowerCase();
    const matchesSearch = (offer: Offer, cardName: string | undefined) => {
      if (!lowered) return true;
      return (
        offer.merchant.toLowerCase().includes(lowered) ||
        (cardName ? cardName.toLowerCase().includes(lowered) : false) ||
        (offer.note ? offer.note.toLowerCase().includes(lowered) : false)
      );
    };

    return offers
      .filter((offer) => {
        if (statusFilter !== "all") {
          if (statusFilter === "maxed") {
            if (offer.status !== "maxed") return false;
          } else if (offer.status !== statusFilter) {
            return false;
          }
        }
        if (
          categoryFilter !== "all" &&
          offer.category !== categoryFilter
        ) {
          return false;
        }
        const card = cardLookup.get(offer.cardId);
        return matchesSearch(offer, card?.name);
      })
      .sort(sortOffersByExpiry);
  }, [offers, statusFilter, categoryFilter, search, cardLookup]);

  const handleDelete = useCallback(
    async (offer: Offer) => {
      if (!db) return;
      const confirmed = window.confirm(
        `Delete the offer "${offer.merchant}" from history? This action cannot be undone.`,
      );
      if (!confirmed) return;
      setDeletingId(offer.id);
    try {
      await deleteOfferPermanently(offer.id);
    } catch (error) {
      console.error(error);
      window.alert("Unable to delete this offer. Please try again.");
    } finally {
      setDeletingId(null);
      }
    },
    [db],
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Offer history</h1>
            <p className="text-sm text-slate-600">
              Review every offer you&apos;ve tracked — active, expired, or
              archived.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Back home
            </Link>
            <Link
              href="/offers"
              className="inline-flex h-10 items-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Manage offers
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition ${
                    statusFilter === filter.value
                      ? "bg-blue-600 text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <label className="relative flex items-center">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 h-5 w-5 text-slate-400" />
                <input
                  className="h-10 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Search merchant, card, or note"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="flex gap-3">
                <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600">
                  <FunnelIcon className="h-4 w-4" aria-hidden="true" />
                  <select
                    className="bg-transparent text-sm outline-none"
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(
                        event.target.value as OfferCategory | "all",
                      )
                    }
                  >
                    {CATEGORY_FILTERS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {filteredOffers.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                No offers match these filters.
              </div>
            ) : (
              filteredOffers.map((offer) => {
                const card = cardLookup.get(offer.cardId);
                const stats = computeOfferStats(offer);
                return (
                  <article
                    key={offer.id}
                    className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm transition ${cardOpacity(offer.status)}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {offer.merchant}
                        </p>
                        <p className="text-xs text-slate-500">
                          {card ? card.name : "Linked card unavailable"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeStyles(offer.status)}`}
                      >
                        {statusLabel(offer.status)}
                      </span>
                    </div>

                    <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                        <p className="font-medium text-slate-900">
                          Progress
                        </p>
                        <p className="mt-1">
                          Earned {formatCurrency(stats.earned)} /{" "}
                          {formatCurrency(offer.cashbackCap)}
                        </p>
                        <p>
                          Spend {formatCurrency(stats.remainSpendToCap)} to max
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white/70 p-3">
                        <p className="font-medium text-slate-900">Details</p>
                        <p className="mt-1">
                          Rate: {(offer.rate * 100).toFixed(0)}% · Cap{" "}
                          {formatCurrency(offer.cashbackCap)}
                        </p>
                        <p>Category: {offer.category}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span>Created {formatDate(offer.createdAt)}</span>
                      <span>Updated {formatDate(offer.updatedAt)}</span>
                      <span>Expires {formatDate(offer.expireAt)}</span>
                      {offer.archivedAt ? (
                        <span>Archived {formatDate(offer.archivedAt)}</span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {offer.note ? (
                        <span className="rounded-full bg-white/70 px-3 py-1">
                          Note: {offer.note}
                        </span>
                      ) : null}
                      <Link
                        href="/offers"
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                      >
                        View in manager
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(offer)}
                        disabled={deletingId === offer.id}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 transition hover:border-red-200 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {deletingId === offer.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
