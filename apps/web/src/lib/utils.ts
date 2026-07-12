import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number, currency = 'KES'): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(cents / 100);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    ...options,
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function initials(first?: string, last?: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || 'A';
}
