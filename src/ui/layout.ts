export const PHONE_LAYOUT = {
  canvas: {
    width: 750,
    height: 1334,
  },
  board: {
    rows: 8,
    columns: 8,
    designSize: 646,
    minCellTouch: 44,
  },
  controls: {
    minTouch: 44,
  },
} as const;

export const PHONE_ASPECT_RATIO = `${PHONE_LAYOUT.canvas.width} / ${PHONE_LAYOUT.canvas.height}`;
