import Link from 'next/link';
import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-brand-700 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">A</span>
          AKILI
        </Link>
        <div>
          <h1 className="max-w-md text-3xl font-bold leading-snug">
            A calmer mind starts with one honest conversation.
          </h1>
          <p className="mt-4 max-w-md text-brand-100">
            Join thousands using AKILI to understand their emotions, build resilience,
            and reach licensed therapists when it matters.
          </p>
        </div>
        <p className="text-sm text-brand-200">
          Private by design · Pay with M-Pesa, Airtel Money, or card
        </p>
      </div>
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
