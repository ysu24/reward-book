"use client";

import { useMemo, useEffect, useState, Fragment } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import {
  PencilSquareIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";

import { getDb, type PerksKeeperDB } from "@/lib/db";
import {
  type Card,
  type CardIssuer,
  type Offer,
  type OfferCategory,
} from "@/lib/types";
import { computeOfferStats, normalizeOffer } from "@/lib/offers";
import { QuickLogPanel } from "@/components/spend/quick-log-panel";

const CATEGORY_ORDER: OfferCategory[] = [
  "Dining",
  "Shopping",
  "Grocery",
  "Gas",
  "Online",
  "Other",
];

const CATEGORY_COPY: Record<OfferCategory, string> = {
  Dining: "Restaurants, cafes, and takeout perks.",
  Shopping: "Retail stores, malls, and in-person buys.",
  Grocery: "Supermarkets, warehouse clubs, and delivery.",
  Gas: "Fuel stations and auto services.",
  Online: "E-commerce, streaming, and digital buys.",
  Other: "Everything else worth tracking.",
};

const CATEGORY_COLOR: Record<OfferCategory, string> = {
  Dining: "bg-orange-100 text-orange-700",
  Shopping: "bg-pink-100 text-pink-700",
  Grocery: "bg-emerald-100 text-emerald-700",
  Gas: "bg-amber-100 text-amber-700",
  Online: "bg-indigo-100 text-indigo-700",
  Other: "bg-slate-100 text-slate-700",
};

const ISSUER_TAG: Record<CardIssuer, string> = {
  Chase: "bg-blue-50 text-blue-600 border-blue-100",
  Amex: "bg-violet-50 text-violet-600 border-violet-100",
  Citi: "bg-cyan-50 text-cyan-600 border-cyan-100",
  Other: "bg-slate-50 text-slate-600 border-slate-200",
};

const EMPTY_CARDS: Card[] = [];
const EMPTY_OFFERS: Offer[] = [];

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(rate: number) {
  if (!Number.isFinite(rate)) return "0%";
  return `${Math.round(rate * 100)}%`;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type OfferVisualState = {
  daysLeft: number;
  isExpired: boolean;
  isArchived: boolean;
  isWarning: boolean;
  badgeText: string;
  badgeClass: string;
  borderClass: string;
  shadowClass: string;
  opacityClass: string;
  statusDetail: string;
  statusDetailClass: string;
};

function getOfferVisualState(offer: Offer, now: number): OfferVisualState {
  const diff = offer.expireAt - now;
  const rawDaysLeft = Math.ceil(diff / DAY_IN_MS);
  const isArchived = offer.status === "archived";
  const isExpired = offer.status === "expired" || diff < 0;
  const daysLeft = isExpired ? 0 : Math.max(0, rawDaysLeft);
  const isDueToday = !isExpired && daysLeft === 0;
  const isWarning = !isArchived && !isExpired && (isDueToday || daysLeft <= 3);

  let badgeText = "Active";
  let badgeClass = "bg-emerald-100 text-emerald-700";
  let statusDetail = "On track";
  let statusDetailClass = "text-emerald-600";

  if (isArchived) {
    badgeText = "Archived";
    badgeClass = "bg-amber-100 text-amber-700";
    statusDetail = "Archived";
    statusDetailClass = "text-amber-700";
  } else if (isExpired) {
    badgeText = "Expired";
    badgeClass = "bg-slate-200 text-slate-700";
    statusDetail = "Expired";
    statusDetailClass = "text-slate-600";
  } else if (isDueToday) {
    badgeText = "Due today";
    badgeClass = "bg-amber-100 text-amber-700";
    statusDetail = "Due today";
    statusDetailClass = "text-amber-700";
  } else if (isWarning) {
    badgeText = daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;
    badgeClass = "bg-amber-100 text-amber-700";
    statusDetail = badgeText;
    statusDetailClass = "text-amber-700";
  }

  const borderClass = isWarning ? "border border-amber-400" : "border border-slate-200";
  const shadowClass = isWarning ? "shadow-md" : "shadow-sm";
  const opacityClass = isExpired || isArchived ? "opacity-60" : "";

  return {
    daysLeft,
    isExpired,
    isArchived,
    isWarning,
    badgeText,
    badgeClass,
    borderClass,
    shadowClass,
    opacityClass,
    statusDetail,
    statusDetailClass,
  };
}

function formatDate(expireAt: number) {
  if (!expireAt) return "N/A";
  return new Date(expireAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

function CategoryIcon({ category }: { category: OfferCategory }) {
  switch (category) {
    case "Dining":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-orange-500"
          aria-hidden="true"
        >
          <path
            d="M5 2a1 1 0 0 0-1 1v7c0 1.1.9 2 2 2v9a1 1 0 1 0 2 0v-9c1.1 0 2-.9 2-2V3a1 1 0 1 0-2 0v6H8V3a1 1 0 1 0-2 0v6H6V3a1 1 0 0 0-1-1Zm10.5 0a.5.5 0 0 0-.5.5V12c0 2.2 1.8 4 4 4v5a1 1 0 1 0 2 0V3.5a.5.5 0 0 0-.72-.45l-3 1.5A.5.5 0 0 1 17 4.1V2.5a.5.5 0 0 0-.5-.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "Shopping":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-pink-500"
          aria-hidden="true"
        >
          <path
            d="M8 7V6a4 4 0 0 1 8 0v1h2a1 1 0 0 1 1 1v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a1 1 0 0 1 1-1h2Zm2-1v1h4V6a2 2 0 0 0-4 0Z"
            fill="currentColor"
          />
        </svg>
      );
    case "Grocery":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-emerald-500"
          aria-hidden="true"
        >
          <path
            d="M5 4a1 1 0 0 1 1-1h2a3 3 0 0 1 6 0h2a1 1 0 0 1 1 1v2h1a1 1 0 0 1 .96 1.27l-2.4 8a1 1 0 0 1-.96.73H7.4a1 1 0 0 1-.96-.73l-2.4-8A1 1 0 0 1 5 6h1V4Zm4-1a1 1 0 0 1 2 0v1H9V3Z"
            fill="currentColor"
          />
        </svg>
      );
    case "Gas":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-amber-500"
          aria-hidden="true"
        >
          <path
            d="M7 3a2 2 0 0 0-2 2v15a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2H7Zm11 2a2 2 0 0 0-1 3.73V20a2 2 0 0 0 4 0v-9a1 1 0 0 0-.29-.7l-1.44-1.44A2 2 0 0 0 17 5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "Online":
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-indigo-500"
          aria-hidden="true"
        >
          <path
            d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3h-3l1.2 2a1 1 0 1 1-1.74 1l-1.6-3H9.14l-1.6 3a1 1 0 0 1-1.74-1L7 19H6a2 2 0 0 1-2-2V5Zm2 0v6h12V5H6Z"
            fill="currentColor"
          />
        </svg>
      );
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-slate-500"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" fill="currentColor" />
        </svg>
      );
  }
}

export function HomeDashboard() {
  const [db, setDb] = useState<PerksKeeperDB | null>(null);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogOfferId, setQuickLogOfferId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDb(getDb());
  }, []);

  const cardsResult = useLiveQuery(
    async () => {
      if (!db) return EMPTY_CARDS;
      return db.cards.orderBy("name").toArray();
    },
    [db],
    EMPTY_CARDS,
  );
  const cards = cardsResult ?? EMPTY_CARDS;

  const offersResult = useLiveQuery(
    async () => {
      if (!db) return EMPTY_OFFERS;
      return db.offers.orderBy("expireAt").toArray();
    },
    [db],
    EMPTY_OFFERS,
  );
  const offers = offersResult ?? EMPTY_OFFERS;

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
  }, [db, offers]);

  const cardLookup = useMemo(() => {
    const map = new Map<string, Card>();
    cards.forEach((card) => map.set(card.id, card));
    return map;
  }, [cards]);

  const normalizedOffers = useMemo(() => offers.map((offer) => normalizeOffer(offer)), [offers]);

  const activeOffers = useMemo(
    () => normalizedOffers.filter((offer) => offer.status === "active"),
    [normalizedOffers],
  );

  const grouped = useMemo(() => {
    const groups = CATEGORY_ORDER.map((category) => ({
      category,
      offers: [] as Array<{
        offer: Offer;
        stats: ReturnType<typeof computeOfferStats>;
        card: Card | undefined;
      }>,
    }));
    const groupMap = new Map<OfferCategory, (typeof groups)[number]>();
    groups.forEach((group) => {
      groupMap.set(group.category, group);
    });

    activeOffers.forEach((offer) => {
      const stats = computeOfferStats(offer);
      const card = cardLookup.get(offer.cardId);
      const bucket = groupMap.get(offer.category);
      if (bucket) {
        bucket.offers.push({ offer, stats, card });
      }
    });

    return groups.filter((group) => group.offers.length > 0);
  }, [activeOffers, cardLookup]);

  const totalEarned = useMemo(() => {
    return activeOffers.reduce(
      (sum, offer) => sum + computeOfferStats(offer).earned,
      0,
    );
  }, [activeOffers]);

  const expiringSoon = useMemo(() => {
    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    return activeOffers.filter((offer) => {
      const diff = offer.expireAt - now;
      return diff > 0 && diff <= threeDays;
    }).length;
  }, [activeOffers]);

  if (!db) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">Loading your offers...</p>
      </div>
    );
  }

  const now = Date.now();

  return (
    <Fragment>
      <div className="space-y-10">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Active cards</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{cards.length}</p>
            <p className="mt-1 text-sm text-slate-500">
              {cards.length ? "Ready to link offers and track perks." : "Add cards to begin."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Offers tracked</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {offers.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {offers.length
                ? "Group by category to spot perks fast."
                : "No offers yet - add your first perk."}
            </p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
            <p className="text-sm text-blue-600">Cashback earned</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {formatCurrency(totalEarned)}
            </p>
            <p className="mt-1 text-sm text-blue-600">
              {expiringSoon > 0
                ? `${expiringSoon} offer${expiringSoon > 1 ? "s" : ""} expiring in 3 days.`
                : "You're on track - keep logging spend."}
            </p>
          </div>
        </section>

      {activeOffers.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white px-8 py-12 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            No offers yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Import perks from your cards to see categories and progress appear here.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/offers"
              className="inline-flex h-11 items-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Add an offer
            </Link>
            <Link
              href="/cards"
              className="inline-flex h-11 items-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Manage cards
            </Link>
          </div>
        </section>
      ) : (
        grouped.map((group) => (
          <section
            key={group.category}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <CategoryIcon category={group.category} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {group.category}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {CATEGORY_COPY[group.category]}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                {group.offers.length}{" "}
                {group.offers.length === 1 ? "offer" : "offers"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {group.offers.map(({ offer, stats, card }) => {
                const visual = getOfferVisualState(offer, now);
                return (
                  <article
                    key={offer.id}
                    className={`flex flex-col justify-between rounded-2xl bg-slate-50/80 p-5 transition ${visual.borderClass} ${visual.shadowClass} ${visual.opacityClass}`}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${card ? ISSUER_TAG[card.issuer] : "bg-slate-100 text-slate-600 border-slate-200"}`}
                          >
                            {card ? `${card.issuer}` : "Card removed"}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${CATEGORY_COLOR[offer.category]}`}
                          >
                            {offer.category}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${visual.badgeClass}`}
                        >
                          {visual.badgeText}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {offer.merchant}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {card ? card.name : "Linked card unavailable"}
                        </p>
                      </div>

                      <p className="text-sm text-slate-600">
                        {offer.rewardType === "percentage"
                          ? `${formatPercent(offer.rate)} back up to ${formatCurrency(offer.cashbackCap)}`
                          : `Earn ${formatCurrency(offer.rewardAmount ?? 0)} when you spend ${formatCurrency(offer.spendThreshold ?? 0)}`}
                      </p>

                      <div className="mt-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-2 rounded-full bg-blue-600 transition-all"
                            style={{
                              width: `${Math.min(stats.percent * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-slate-500">
                        <span>
                          Earned {formatCurrency(stats.earned)} /{" "}
                          {formatCurrency(
                            offer.rewardType === "threshold"
                              ? offer.rewardAmount ?? offer.cashbackCap
                              : offer.cashbackCap,
                          )}
                        </span>
                        <span>
                          {stats.remainSpendToCap <= 0
                            ? offer.rewardType === "percentage"
                              ? "Maxed"
                              : "Reward unlocked"
                            : offer.rewardType === "percentage"
                              ? `Spend ${formatCurrency(stats.remainSpendToCap)} more`
                              : `Spend ${formatCurrency(stats.remainSpendToCap)} more to unlock`}
                        </span>
                        </div>
                      </div>

                      {offer.note ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                          <span>{offer.note}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>Expires {formatDate(offer.expireAt)}</span>
                      <span className={`font-medium ${visual.statusDetailClass}`}>
                        {visual.statusDetail}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setQuickLogOfferId(offer.id);
                        setIsQuickLogOpen(true);
                      }}
                      disabled={visual.isArchived}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Log purchase
                    </button>
                      <Link
                        href="/offers"
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                        aria-label={`Edit offer ${offer.merchant}`}
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
                        Manage offer
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
      </div>
      <QuickLogPanel
        isOpen={isQuickLogOpen}
        offers={activeOffers}
        cards={cardLookup}
        initialOfferId={quickLogOfferId}
        onClose={() => {
          setIsQuickLogOpen(false);
          setQuickLogOfferId(null);
        }}
      />
    </Fragment>
  );
}
