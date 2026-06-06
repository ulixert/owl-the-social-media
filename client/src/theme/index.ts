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
  // Match both the explicit `color="mono"` and the *default* primary (a Button
  // with no color prop arrives here with color undefined, which is why the Log in
  // button previously skipped this branch and looked different from Follow).
  const isMono = input.color === 'mono' || input.color == null;
  if (isMono && input.variant === 'filled') {
    return {
      ...resolved,
      // Near-black / near-white (not pure #000/#fff, which is harsh at scale),
      // inverting by scheme: dark button + light text in light mode, and the
      // reverse in dark mode. These match the logo fills so the two agree.
      background: 'light-dark(#101010, #f3f5f7)',
      color: 'light-dark(#f3f5f7, #101010)',
      // A clearly visible hover: lighten the black button, darken the white one.
      hover: 'light-dark(var(--mantine-color-dark-5), var(--mantine-color-gray-3))',
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
  variantColorResolver,
  components: {
    // Default every Button to the monochrome filled look, so a plain <Button>
    // gets the exact same treatment as one with explicit color="mono"
    // variant="filled" (which is what made the resolver's bg/hover apply). An
    // explicit color/variant on a button still overrides these.
    Button: { defaultProps: { color: 'mono', variant: 'filled' } },
  },
});
