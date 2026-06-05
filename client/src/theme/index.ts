import { createTheme, MantineColorsTuple } from '@mantine/core';

// Monochrome scale, light (0) → dark (9). Used as the primary color so accents
// and filled controls are black/white instead of a hue.
const mono: MantineColorsTuple = [
  '#f8f8f8',
  '#e6e6e6',
  '#cfcfcf',
  '#b3b3b3',
  '#8f8f8f',
  '#6b6b6b',
  '#4d4d4d',
  '#333333',
  '#1a1a1a',
  '#0a0a0a',
];

export const theme = createTheme({
  colors: { mono },
  primaryColor: 'mono',
  // Invert by scheme: near-black filled controls in light mode (shade 9),
  // near-white in dark mode (shade 0) — the Threads-style black/white button.
  primaryShade: { light: 9, dark: 0 },
  // Pick readable (black/white) text on filled controls automatically.
  autoContrast: true,
});
