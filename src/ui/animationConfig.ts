export const BOARD_ANIMATION_CONFIG = {
  selectMs: 80,
  validSwapMs: 160,
  invalidSwapOutMs: 120,
  invalidSwapHoldMs: 50,
  invalidSwapBackMs: 120,
  clearMs: 220,
  chainGapMs: 100,
  dropPerCellMs: 68,
  dropMinMs: 160,
  dropMaxMs: 360,
  spawnMs: 230,
  settleBufferMs: 40,
} as const;

export function getDropDuration(rowDistance: number): number {
  const distance = Math.max(1, Math.abs(Math.round(rowDistance)));
  return Math.min(
    BOARD_ANIMATION_CONFIG.dropMaxMs,
    Math.max(
      BOARD_ANIMATION_CONFIG.dropMinMs,
      distance * BOARD_ANIMATION_CONFIG.dropPerCellMs,
    ),
  );
}
