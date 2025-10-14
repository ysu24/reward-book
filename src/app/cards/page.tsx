import type { Metadata } from "next";
import Link from "next/link";

import { CardManager } from "@/components/cards/card-manager";

export const metadata: Metadata = {
  title: "Manage cards • Perks Keeper",
  description:
    "Add, review, and remove the credit cards you want to track in Perks Keeper.",
};

export default function CardsPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <Link
              href="/"
              className="text-base font-semibold text-slate-900 transition hover:text-blue-600"
            >
              Perks Keeper
            </Link>
            <p className="text-sm text-slate-500">Card management</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              View history
            </Link>
            <Link
              href="/offers"
              className="inline-flex h-10 items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-blue-600"
            >
              View offers
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">
            Keep your card wallet up to date
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Add cards you use for tracking offers. Keeping this list current
            makes it easy to assign offers and monitor progress in later steps.
          </p>
        </div>

        <CardManager />
      </main>
    </div>
  );
}
