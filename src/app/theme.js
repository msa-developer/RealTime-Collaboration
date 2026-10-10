import { extendTheme } from "@chakra-ui/react";

/* Tokens referenced across the components (canvas, hairline, link, ...) that
   were never defined before — restored here so the UI renders as designed. */
const theme = extendTheme({
  colors: {
    canvas: "#fafafa",
    elevated: "#ffffff",
    hairline: "#eaeaea",
    ink: "#171717",
    body: "#3d3d3d",
    mute: "#666666",
    faint: "#9b9b9b",
    link: "#0070f3",
    error: "#e53e3e",
    warningDeep: "#b45309",
    cyan: "#d9f6fb",
  },
  space: {
    xxs: "2px",
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
  },
  fonts: {
    mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  textStyles: {
    monoEyebrow: {
      fontFamily: "mono",
      fontSize: "11px",
      fontWeight: "600",
      letterSpacing: "0.06em",
    },
    bodySm: {
      fontSize: "13px",
    },
    code: {
      fontFamily: "mono",
    },
  },
  components: {
    Button: {
      variants: {
        primarySm: {
          bg: "ink",
          color: "white",
          _hover: { bg: "#333333" },
        },
      },
    },
  },
});

export default theme;
