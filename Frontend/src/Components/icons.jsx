/**
 * Inline ink icons — 1.5px strokes on the Geist grid.
 */

const svgProps = {
  width: "14",
  height: "14",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export const CopyIcon = (props) => (
  <svg {...svgProps} {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 10.5h1.5" />
  </svg>
);

export const PlayIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M5 3.5v9l7.5-4.5L5 3.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const ArrowLeftIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M6 3L2 8l4 5" />
    <path d="M2 8h12" />
  </svg>
);

export const CheckIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M3 8.5l3.5 3.5L13 4.5" />
  </svg>
);

export const ExternalLinkIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M6 4h6v6" />
    <path d="M12 4L4 12" />
    <path d="M11 2h3v3" />
  </svg>
);
