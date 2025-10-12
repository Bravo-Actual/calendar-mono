import type { ClientCategory } from '@/lib/data-v2';

type EventCategory = NonNullable<ClientCategory['color']>;

export interface CategoryColor {
  value: EventCategory;
  label: string;
  // CSS variable references for Fluent colors
  colorVar: string;
  // Helper to get the actual color value
  getColor: () => string;
}

export const categoryColors: CategoryColor[] = [
  {
    value: 'neutral',
    label: 'Neutral',
    colorVar: '--colorNeutralStroke1',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorNeutralStroke1'),
  },
  {
    value: 'slate',
    label: 'Slate',
    colorVar: '--colorPaletteSlateBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorPaletteSlateBackground'),
  },
  {
    value: 'orange',
    label: 'Orange',
    colorVar: '--colorPaletteOrangeBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorPaletteOrangeBackground'),
  },
  {
    value: 'yellow',
    label: 'Yellow',
    colorVar: '--colorPaletteYellowBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorPaletteYellowBackground'),
  },
  {
    value: 'green',
    label: 'Green',
    colorVar: '--colorPaletteGreenBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorPaletteGreenBackground'),
  },
  {
    value: 'blue',
    label: 'Blue',
    colorVar: '--colorPaletteBlueBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorPaletteBlueBackground'),
  },
  {
    value: 'indigo',
    label: 'Indigo',
    colorVar: '--colorPaletteIndigoBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorPaletteIndigoBackground'),
  },
  {
    value: 'violet',
    label: 'Violet',
    colorVar: '--colorPaletteVioletBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorPaletteVioletBackground'),
  },
  {
    value: 'fuchsia',
    label: 'Fuchsia',
    colorVar: '--colorPaletteFuchsiaBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue(
        '--colorPaletteFuchsiaBackground'
      ),
  },
  {
    value: 'rose',
    label: 'Rose',
    colorVar: '--colorPaletteRoseBackground',
    getColor: () =>
      getComputedStyle(document.documentElement).getPropertyValue('--colorPaletteRoseBackground'),
  },
];

export function getCategoryColor(category: EventCategory): CategoryColor {
  return categoryColors.find((c) => c.value === category) || categoryColors[0];
}

/**
 * Get the color value for a category using CSS variables
 * This works in both light and dark modes automatically
 */
export function getCategoryColorValue(category: EventCategory): string {
  const colorDef = getCategoryColor(category);
  return `var(${colorDef.colorVar})`;
}
