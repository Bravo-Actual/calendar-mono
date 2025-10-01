import type { ClientCategory } from '@/lib/data-v2';

type EventCategory = NonNullable<ClientCategory['color']>;

export interface CategoryColor {
  value: EventCategory;
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  hoverClass: string;
}

export const categoryColors: CategoryColor[] = [
  {
    value: 'neutral',
    label: 'Neutral',
    bgClass: 'bg-neutral-100 dark:bg-neutral-800',
    textClass: 'text-neutral-900 dark:text-neutral-100',
    borderClass: 'border-neutral-300 dark:border-neutral-600',
    hoverClass: 'hover:bg-neutral-200 dark:hover:bg-neutral-700',
  },
  {
    value: 'slate',
    label: 'Slate',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-900 dark:text-slate-100',
    borderClass: 'border-slate-300 dark:border-slate-600',
    hoverClass: 'hover:bg-slate-200 dark:hover:bg-slate-700',
  },
  {
    value: 'orange',
    label: 'Orange',
    bgClass: 'bg-orange-100 dark:bg-orange-900',
    textClass: 'text-orange-900 dark:text-orange-100',
    borderClass: 'border-orange-300 dark:border-orange-600',
    hoverClass: 'hover:bg-orange-200 dark:hover:bg-orange-800',
  },
  {
    value: 'yellow',
    label: 'Yellow',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900',
    textClass: 'text-yellow-900 dark:text-yellow-100',
    borderClass: 'border-yellow-300 dark:border-yellow-600',
    hoverClass: 'hover:bg-yellow-200 dark:hover:bg-yellow-800',
  },
  {
    value: 'green',
    label: 'Green',
    bgClass: 'bg-green-100 dark:bg-green-900',
    textClass: 'text-green-900 dark:text-green-100',
    borderClass: 'border-green-300 dark:border-green-600',
    hoverClass: 'hover:bg-green-200 dark:hover:bg-green-800',
  },
  {
    value: 'blue',
    label: 'Blue',
    bgClass: 'bg-blue-100 dark:bg-blue-900',
    textClass: 'text-blue-900 dark:text-blue-100',
    borderClass: 'border-blue-300 dark:border-blue-600',
    hoverClass: 'hover:bg-blue-200 dark:hover:bg-blue-800',
  },
  {
    value: 'indigo',
    label: 'Indigo',
    bgClass: 'bg-indigo-100 dark:bg-indigo-900',
    textClass: 'text-indigo-900 dark:text-indigo-100',
    borderClass: 'border-indigo-300 dark:border-indigo-600',
    hoverClass: 'hover:bg-indigo-200 dark:hover:bg-indigo-800',
  },
  {
    value: 'violet',
    label: 'Violet',
    bgClass: 'bg-violet-100 dark:bg-violet-900',
    textClass: 'text-violet-900 dark:text-violet-100',
    borderClass: 'border-violet-300 dark:border-violet-600',
    hoverClass: 'hover:bg-violet-200 dark:hover:bg-violet-800',
  },
  {
    value: 'fuchsia',
    label: 'Fuchsia',
    bgClass: 'bg-fuchsia-100 dark:bg-fuchsia-900',
    textClass: 'text-fuchsia-900 dark:text-fuchsia-100',
    borderClass: 'border-fuchsia-300 dark:border-fuchsia-600',
    hoverClass: 'hover:bg-fuchsia-200 dark:hover:bg-fuchsia-800',
  },
  {
    value: 'rose',
    label: 'Rose',
    bgClass: 'bg-rose-100 dark:bg-rose-900',
    textClass: 'text-rose-900 dark:text-rose-100',
    borderClass: 'border-rose-300 dark:border-rose-600',
    hoverClass: 'hover:bg-rose-200 dark:hover:bg-rose-800',
  },
];

export function getCategoryColor(category: EventCategory): CategoryColor {
  return categoryColors.find((c) => c.value === category) || categoryColors[0];
}
