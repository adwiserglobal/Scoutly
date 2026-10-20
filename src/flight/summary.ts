import type { Business } from '../types';

/** What the user did during a flight, shown in the "Negócios encontrados no seu voo" modal. */
export interface FlightSummary {
  durationSeconds: number;
  flownCount: number;
  noSiteCount: number;
  opened: Business[];
  /** Businesses that were close to the flight path (used to find missed opportunities). */
  seen: Business[];
  endedBy: 'user' | 'limit';
}

export interface FlightLimit {
  unlimited: boolean;
  remainingSeconds: number | null;
}
