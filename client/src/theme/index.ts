import {
  createTheme,
  defaultVariantColorsResolver,
  MantineColorsTuple,
  VariantColorsResolver,
} from '@mantine/core';

// Monochrome scale, light (0) → dark (9). Used as the primary color so accents
// (links, loaders, outline/light variants) are black/white instead of a hue.
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

// Filled monochrome controls (the primary CTA look) are defined against the
// semantic text/body vars rather than a fixed shade, so they reliably invert
// with the color scheme AND keep readable contrast: black bg + white text in
// light mode, white bg + black text in dark mode. (autoContrast on a near-white
// shade wasn't flipping the label, leaving white-on-white in dark mode.)
const variantColorResolver: VariantColorsResolver = (input) => {
  const resolved = defaultVariantColorsResolver(input);
  if (input.color === 'mono' && input.variant === 'filled') {
    return {
      ...resolved,
      background: 'var(--mantine-color-text)',
      hover: 'light-dark(var(--mantine-color-dark-6), var(--mantine-color-gray-2))',
      color: 'var(--mantine-color-body)',
      border: 'none',
    };
  }
  return resolved;
};

export const theme = createTheme({
  colors: { mono },
  primaryColor: 'mono',
  // Near-black accents in light mode (shade 9), near-white in dark mode (shade 0)
  // for the non-filled uses (outline/light variants, loaders, text accents).
  primaryShade: { light: 9, dark: 0 },
  autoContrast: true,
  variantColorResolver,
});
