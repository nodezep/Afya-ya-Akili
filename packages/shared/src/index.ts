/**
 * @akili/shared — types and constants shared across API, web, and mobile.
 */

export type Role = 'USER' | 'THERAPIST' | 'CORPORATE_ADMIN' | 'ADMIN' | 'SUPER_ADMIN';
export type PlanTier = 'FREE' | 'PREMIUM' | 'CORPORATE';
export type RiskLevel = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';
export type PaymentProvider = 'STRIPE' | 'MPESA' | 'AIRTEL_MONEY';
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';
export type AssessmentType = 'PHQ9' | 'GAD7' | 'PSS10' | 'WHO5' | 'PCL5' | 'AUDIT';
export type Locale = 'en' | 'sw';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const SUPPORTED_LOCALES: Locale[] = ['en', 'sw'];

export const CRISIS_LINES = {
  KE: { name: 'Befrienders Kenya', phone: '+254722178177' },
} as const;

export const FREE_DAILY_CHAT_LIMIT = 20;
export const SESSION_MINUTES = 60;
