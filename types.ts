
export type TimeSlot = '08:00' | '11:00' | '18:00' | '22:00';

export interface DailyQuote {
  time: TimeSlot;
  text: string;
  emoji: string;
}

export interface Moment {
  id: string;
  content: string;
  timestamp: number;
  hasRose: boolean;
  isReceived: boolean;
}

export interface GardenState {
  roses: number[]; // Array of day numbers where rose was collected
  streak: number;
  lastCollectionDate: string | null; // YYYY-MM-DD
}

export type View = 'intro' | 'home' | 'timeline' | 'garden';
