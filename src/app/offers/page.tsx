import type { Metadata } from "next";
import Link from "next/link";

import { OfferManager } from "@/components/offers/offer-manager";

export const metadata: Metadata = {
  title: "Manage offers • Reward Book",
  description:
    "Create, edit, and track card-linked offers with spending progress and caps.",
};

export default function OffersPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <Link
              href="/"
              className="text-base font-semibold text-slate-900 transition hover:text-blue-600"
            >
              Reward Book
            </Link>
            <p className="text-sm text-slate-500">Offer management</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/cards"
              className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Manage cards
            </Link>
            <Link
              href="/history"
              className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              View history
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              Back home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Offer catalog</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Add, review, and edit offers tied to your cards. Use this workspace
            to keep caps, rates, and expiry details tidy before they feed into
            the main dashboard.
          </p>
        </div>

        <OfferManager />
      </main>
    </div>
  );
}
