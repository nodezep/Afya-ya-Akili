'use client';

import { motion } from 'framer-motion';
import {
  Bot,
  BookOpen,
  Building2,
  Calendar,
  HeartPulse,
  Moon,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/providers/app-providers';
import { Button } from '@/components/ui';

const features = [
  {
    icon: Bot,
    title: 'AI companion, 24/7',
    description:
      'Talk to Akili any time — an emotionally intelligent companion grounded in CBT and mindfulness, in English and Swahili.',
  },
  {
    icon: HeartPulse,
    title: 'Mood tracking',
    description: 'Daily check-ins reveal patterns in your emotions, sleep, and stress over time.',
  },
  {
    icon: NotebookPen,
    title: 'Private journal',
    description: 'Guided prompts and automatic sentiment insight — your thoughts stay yours.',
  },
  {
    icon: Moon,
    title: 'Meditation library',
    description: 'Guided sessions for sleep, anxiety, focus, and stress — from 5 to 20 minutes.',
  },
  {
    icon: Calendar,
    title: 'Licensed therapists',
    description: 'Browse verified professionals, book sessions, and pay with M-Pesa, Airtel Money, or card.',
  },
  {
    icon: Video,
    title: 'Secure video sessions',
    description: 'Meet your therapist in encrypted video calls right inside AKILI.',
  },
  {
    icon: BookOpen,
    title: 'Learning center',
    description: 'Bite-size courses on anxiety, sleep, and resilience, built on evidence-based methods.',
  },
  {
    icon: Building2,
    title: 'For teams',
    description: 'Corporate wellbeing with anonymised insights that respect every employee\'s privacy.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-brand-700 dark:text-brand-400">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">A</span>
            AKILI
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 dark:text-slate-300 md:flex">
            <a href="#features" className="hover:text-brand-600">Features</a>
            <a href="#pricing" className="hover:text-brand-600">Pricing</a>
            <Link href="/therapists" className="hover:text-brand-600">Therapists</Link>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button>Open dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300">
                  Sign in
                </Link>
                <Link href="/auth/register">
                  <Button>Get started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-950" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800 dark:bg-brand-900/50 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              Mental health support built for Africa, open to the world
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              Your mind matters.{' '}
              <span className="text-brand-600 dark:text-brand-400">Akili</span> is here to listen.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
              An AI companion for everyday support, tools to understand your emotions,
              and licensed therapists when you need a human — all in one private, affordable place.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/auth/register">
                <Button size="lg">Start free — no card needed</Button>
              </Link>
              <Link href="/therapists">
                <Button size="lg" variant="outline">Browse therapists</Button>
              </Link>
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              Private by design. Your conversations are never sold or shared.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
          Everything your wellbeing needs
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600 dark:text-slate-300">
          From a rough Tuesday to long-term growth — AKILI meets you where you are.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-slate-200 p-6 dark:border-slate-800"
            >
              <feature.icon className="h-8 w-8 text-brand-600" />
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-20 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            Simple, honest pricing
          </h2>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {[
              {
                name: 'Free',
                price: 'KES 0',
                tagline: 'Core tools for everyone',
                features: ['AI chat (20 messages/day)', 'Mood tracker & journal', 'Basic meditations', 'Self assessments'],
              },
              {
                name: 'Premium',
                price: 'KES 999/mo',
                tagline: 'Unlimited support',
                features: ['Unlimited AI chat', 'Full meditation library', 'All courses', 'Advanced insights'],
                highlight: true,
              },
              {
                name: 'Corporate',
                price: 'KES 799/seat',
                tagline: 'For teams of 5+',
                features: ['Everything in Premium', 'Corporate dashboard', 'Anonymised team insights', 'Priority support'],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.highlight
                    ? 'border-brand-600 bg-white shadow-lg ring-1 ring-brand-600 dark:bg-slate-900'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <h3 className="font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
                <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-400">{plan.price}</p>
                <p className="text-sm text-slate-500">{plan.tagline}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register" className="mt-6 block">
                  <Button className="w-full" variant={plan.highlight ? 'primary' : 'outline'}>
                    Choose {plan.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            Pay with M-Pesa, Airtel Money, or card. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Crisis banner */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-2xl bg-brand-700 p-8 text-center text-white">
          <h2 className="text-xl font-semibold">In crisis right now?</h2>
          <p className="mx-auto mt-2 max-w-xl text-brand-100">
            AKILI is not an emergency service. If you or someone you know is in danger,
            call emergency services or Befrienders Kenya on{' '}
            <a href="tel:+254722178177" className="font-semibold underline">+254 722 178 177</a> — free, confidential, 24/7.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} AKILI Health. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/auth/register" className="hover:text-brand-600">Get started</Link>
            <a href="#features" className="hover:text-brand-600">Features</a>
            <a href="#pricing" className="hover:text-brand-600">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
