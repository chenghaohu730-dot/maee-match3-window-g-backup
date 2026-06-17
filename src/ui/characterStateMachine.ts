import type { GameplayEvent, GameplayState } from "../core/gameplayTypes.ts";
import {
  CHARACTER_ANIMATION_CONFIGS,
  getCharacterAnimationConfig,
} from "./characterAnimationConfig.ts";
import type {
  CharacterAnimationSnapshot,
  CharacterId,
  EnemyAnimationState,
  YizaiAnimationState,
} from "./characterAnimationTypes.ts";

interface AnimationRequest {
  characterId: CharacterId;
  state: YizaiAnimationState | EnemyAnimationState;
}

interface RuntimeCharacterState<StateName extends string> {
  state: StateName;
  priority: number;
  loop: boolean;
}

export class CharacterStateMachine {
  private yizai: RuntimeCharacterState<YizaiAnimationState> =
    createRuntimeState("yizai", "idle");
  private enemy: RuntimeCharacterState<EnemyAnimationState> = createRuntimeState(
    "enemy",
    "idle",
  );

  reset(): void {
    this.yizai = createRuntimeState("yizai", "idle");
    this.enemy = createRuntimeState("enemy", "idle");
  }

  applyGameplayEvents(
    events: readonly GameplayEvent[],
    state?: GameplayState,
  ): CharacterAnimationSnapshot {
    for (const request of buildStateFallbackRequests(state)) {
      this.playRequest(request);
    }

    for (const request of mapGameplayEventsToAnimationRequests(events)) {
      this.playRequest(request);
    }

    return this.getSnapshot();
  }

  play(
    characterId: "yizai",
    state: YizaiAnimationState,
    options?: { force?: boolean },
  ): boolean;
  play(
    characterId: "enemy",
    state: EnemyAnimationState,
    options?: { force?: boolean },
  ): boolean;
  play(
    characterId: CharacterId,
    state: YizaiAnimationState | EnemyAnimationState,
    options: { force?: boolean } = {},
  ): boolean {
    if (characterId === "yizai") {
      const next = createRuntimeState("yizai", state as YizaiAnimationState);

      if (!options.force && next.priority < this.yizai.priority) {
        return false;
      }

      this.yizai = next;
      return true;
    }

    const next = createRuntimeState("enemy", state as EnemyAnimationState);

    if (!options.force && next.priority < this.enemy.priority) {
      return false;
    }

    this.enemy = next;
    return true;
  }

  complete(characterId: CharacterId): CharacterAnimationSnapshot {
    if (characterId === "yizai") {
      const config = getCharacterAnimationConfig("yizai", this.yizai.state);

      if (!config.loop && config.returnTo) {
        this.play("yizai", config.returnTo, { force: true });
      }

      return this.getSnapshot();
    }

    const config = getCharacterAnimationConfig("enemy", this.enemy.state);

    if (!config.loop && config.returnTo) {
      this.play("enemy", config.returnTo, { force: true });
    }

    return this.getSnapshot();
  }

  getSnapshot(): CharacterAnimationSnapshot {
    return {
      yizai: this.yizai.state,
      enemy: this.enemy.state,
    };
  }

  private playRequest(request: AnimationRequest): boolean {
    if (request.characterId === "yizai") {
      return this.play("yizai", request.state as YizaiAnimationState);
    }

    return this.play("enemy", request.state as EnemyAnimationState);
  }
}

export function createCharacterAnimationSnapshot(
  state: GameplayState,
  events: readonly GameplayEvent[],
): CharacterAnimationSnapshot {
  const machine = new CharacterStateMachine();
  return machine.applyGameplayEvents(events, state);
}

export function mapGameplayEventsToAnimationRequests(
  events: readonly GameplayEvent[],
): AnimationRequest[] {
  const requests: AnimationRequest[] = [];

  for (const event of events) {
    if (event.type === "skillTriggered") {
      requests.push({
        characterId: "yizai",
        state: event.level === "ultimate" ? "ultimate" : "skill",
      });
      continue;
    }

    if (event.type !== "combat") {
      continue;
    }

    switch (event.event.type) {
      case "enemyDamaged":
        requests.push(
          { characterId: "yizai", state: "attack" },
          { characterId: "enemy", state: "hit" },
        );
        break;
      case "playerDamaged":
        requests.push(
          { characterId: "yizai", state: "hurt" },
          { characterId: "enemy", state: "attack" },
        );
        break;
      case "enemyDefeated":
        requests.push({ characterId: "enemy", state: "defeat" });
        break;
      case "gameWon":
        requests.push({ characterId: "yizai", state: "ultimate" });
        break;
      case "gameLost":
        requests.push({ characterId: "yizai", state: "hurt" });
        break;
      case "waveStarted":
        requests.push({ characterId: "enemy", state: "idle" });
        break;
      default:
        break;
    }
  }

  return requests;
}

function buildStateFallbackRequests(
  state: GameplayState | undefined,
): AnimationRequest[] {
  if (!state) {
    return [];
  }

  const requests: AnimationRequest[] = [];

  if (state.phase === "lost" || state.playerHp <= 0) {
    requests.push({ characterId: "yizai", state: "hurt" });
  } else if (state.phase === "won") {
    requests.push({ characterId: "yizai", state: "ultimate" });
  }

  if (
    state.enemyInfiniteHp !== true &&
    state.enemyHp <= 0 &&
    (state.phase === "won" || state.phase === "playing")
  ) {
    requests.push({ characterId: "enemy", state: "defeat" });
  }

  return requests;
}

function createRuntimeState(
  characterId: "yizai",
  state: YizaiAnimationState,
): RuntimeCharacterState<YizaiAnimationState>;
function createRuntimeState(
  characterId: "enemy",
  state: EnemyAnimationState,
): RuntimeCharacterState<EnemyAnimationState>;
function createRuntimeState(
  characterId: CharacterId,
  state: YizaiAnimationState | EnemyAnimationState,
):
  | RuntimeCharacterState<YizaiAnimationState>
  | RuntimeCharacterState<EnemyAnimationState> {
  if (characterId === "yizai") {
    const config = CHARACTER_ANIMATION_CONFIGS.yizai[state as YizaiAnimationState];

    return {
      state: state as YizaiAnimationState,
      priority: config.priority,
      loop: config.loop,
    };
  }

  const config = CHARACTER_ANIMATION_CONFIGS.enemy[state as EnemyAnimationState];

  return {
    state: state as EnemyAnimationState,
    priority: config.priority,
    loop: config.loop,
  };
}
