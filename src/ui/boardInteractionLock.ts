import type { GamePhase } from "../core/gameplayTypes.ts";

export class BoardInteractionLock {
  private animating = false;

  get isAnimating(): boolean {
    return this.animating;
  }

  canUseBoard(
    phase: GamePhase,
    hasBlockingModal: boolean,
    hasBlockingPresentation = false,
  ): boolean {
    return (
      phase === "playing" &&
      !hasBlockingModal &&
      !this.animating &&
      !hasBlockingPresentation
    );
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
