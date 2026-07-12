'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import {
  ButtonHTMLAttributes,
  forwardRef,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

// ---------------- Button ----------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500',
  secondary:
    'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500',
  outline:
    'border border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

// ---------------- Inputs ----------------

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm',
        'placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-white p-3 text-sm',
        'placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300', className)}
      {...props}
    />
  );
}

// ---------------- Card ----------------

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-slate-100 p-5 dark:border-slate-800', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-semibold text-slate-900 dark:text-slate-100', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

// ---------------- Badge ----------------

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
};

export function Badge({
  variant = 'default',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

// ---------------- Misc ----------------

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700">
      <p className="font-medium text-slate-900 dark:text-slate-100">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
      {message}
    </div>
  );
}

export function Avatar({
  src,
  fallback,
  size = 40,
}: {
  src?: string | null;
  fallback: string;
  size?: number;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={fallback}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-brand-600 font-medium text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {fallback}
    </div>
  );
}
