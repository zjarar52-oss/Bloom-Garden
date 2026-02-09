
import { SEED_QUOTES } from './constants.tsx';
import { TimeSlot } from './types';

export const getQuoteForDate = (date: Date, slot: TimeSlot): { text: string; emoji: string } => {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const quotes = SEED_QUOTES[slot];
  const index = Math.abs(dayOfYear % quotes.length);
  
  const emojis = ['💛', '🌱', '✨', '🌙', '🌤', '☀️', '🌆', '🍀', '💡', '🌈'];
  const emojiIndex = Math.abs((dayOfYear + slot.length) % emojis.length);

  return {
    text: quotes[index],
    emoji: emojis[emojiIndex]
  };
};

export const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getChineseDateStr = (date: Date): string => {
  const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weeks[date.getDay()]}`;
};

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

export const getYesterday = (dateStr: string): string => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return formatDate(d);
};
