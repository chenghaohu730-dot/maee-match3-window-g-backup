import {
  createEnemyAttackTimeline,
  createGameEndTimeline,
  createReshuffleTimeline,
  createTurnTimeline,
  createWaveTransitionTimeline,
} from "./combatTimeline.ts";
import type {
  CombatTimeline,
  CombatTimelineEvent,
  EnemyAttackPresentationInput,
  GameEndPresentationInput,
  PresentationPlaybackInput,
  ReshufflePresentationInput,
  TurnPresentationInput,
  WaveTransitionPresentationInput,
} from "./combatTimelineTypes.ts";

export interface PresentationScheduler {
  wait(durationMs: number): Promise<void>;
}

export interface PresentationDirectorOptions {
  scheduler?: PresentationScheduler;
  onTimelineStart?: (
    timeline: CombatTimeline,
    input: PresentationPlaybackInput,
  ) => void | Promise<void>;
  onTimelineEvent?: (
    event: CombatTimelineEvent,
    timeline: CombatTimeline,
    input: PresentationPlaybackInput,
  ) => void | Promise<void>;
  onTimelineComplete?: (
    timeline: CombatTimeline,
    input: PresentationPlaybackInput,
  ) => void | Promise<void>;
  onLowPriorityCancelled?: () => void;
}

export class PresentationDirector {
  private readonly scheduler: PresentationScheduler;
  private busy = false;
  private lowPriorityCancelled = false;

  constructor(private readonly options: PresentationDirectorOptions = {}) {
    this.scheduler = options.scheduler ?? {
      wait: (durationMs) =>
        new Promise((resolve) => {
          window.setTimeout(resolve, durationMs);
        }),
    };
  }

  isBusy(): boolean {
    return this.busy;
  }

  cancelLowPriorityEffects(): void {
    this.lowPriorityCancelled = true;
    this.options.onLowPriorityCancelled?.();
  }

  async playTurnPresentation(input: TurnPresentationInput): Promise<void> {
    await this.playTimeline(createTurnTimeline(input), input);
  }

  async playEnemyAttack(input: EnemyAttackPresentationInput): Promise<void> {
    await this.playTimeline(createEnemyAttackTimeline(input), input);
  }

  async playWaveTransition(
    input: WaveTransitionPresentationInput,
  ): Promise<void> {
    await this.playTimeline(createWaveTransitionTimeline(input), input);
  }

  async playGameEnd(input: GameEndPresentationInput): Promise<void> {
    await this.playTimeline(createGameEndTimeline(input), input);
  }

  async playReshuffle(input: ReshufflePresentationInput): Promise<void> {
    await this.playTimeline(createReshuffleTimeline(input), input);
  }

  private async playTimeline(
    timeline: CombatTimeline,
    input: PresentationPlaybackInput,
  ): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;
    this.lowPriorityCancelled = false;

    try {
      await this.options.onTimelineStart?.(timeline, input);
      await this.dispatchTimelineEvents(timeline, input);
      await this.options.onTimelineComplete?.(timeline, input);
    } finally {
      this.busy = false;
      this.lowPriorityCancelled = false;
    }
  }

  private async dispatchTimelineEvents(
    timeline: CombatTimeline,
    input: PresentationPlaybackInput,
  ): Promise<void> {
    let cursorMs = 0;
    const unlockAtMs = timeline.inputUnlockAtMs ?? timeline.durationMs;

    for (const event of timeline.events) {
      if (event.atMs > unlockAtMs) {
        continue;
      }

      const waitMs = Math.max(0, event.atMs - cursorMs);
      if (waitMs > 0) {
        await this.scheduler.wait(waitMs);
        cursorMs = event.atMs;
      }

      if (this.lowPriorityCancelled && event.priority === "low") {
        continue;
      }

      await this.options.onTimelineEvent?.(event, timeline, input);
    }

    const remainingMs = Math.max(0, unlockAtMs - cursorMs);
    if (remainingMs > 0) {
      await this.scheduler.wait(remainingMs);
    }
  }
}
