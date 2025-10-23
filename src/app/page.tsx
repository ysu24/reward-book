import { Suspense } from "react";
import Link from "next/link";

import { HomeDashboard } from "@/components/home/dashboard";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">
              Reward Book
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">My offers</h1>
            <p className="text-sm text-slate-600">
              Centralize every reward. Know what to spend next.
            </p>
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
              href="/offers"
              className="inline-flex h-10 items-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Add offer
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12">
        <Suspense
          fallback={
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm text-slate-500">Loading dashboard...</p>
            </div>
          }
        >
          <HomeDashboard />
        </Suspense>
      </main>
    </div>
  );
}
