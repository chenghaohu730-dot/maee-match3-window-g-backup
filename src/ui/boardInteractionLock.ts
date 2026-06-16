import type { GamePhase } from "../core/gameplayTypes.ts";

export class BoardInteractionLock {
  private animating = false;

  get isAnimating(): boolean {
    return this.animating;
  }

  canUseBoard(phase: GamePhase, hasBlockingModal: boolean): boolean {
    return phase === "playing" && !hasBlockingModal && !this.animating;
  }

  beginAnimation(): boolean {
    if (this.animating) {
      return false;
    }

    this.animating = true;
    return true;
  }

  endAnimation(): void {
    this.animating = false;
  }
}
