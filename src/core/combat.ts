import type {
  ArmorBreakState,
  CombatEvent,
  CombatMoveSummary,
  CombatState,
  CombatStatus,
  EnemyState,
  EnemyWave,
  PlayerState,
} from "./combatTypes.ts";
import { FAIRY_TALE_WAVES } from "./waves.ts";

const PLAYER_MAX_HP = 100;

export class CombatSystem {
  private readonly waves: EnemyWave[];
  private player: PlayerState = createInitialPlayer();
  private enemy: EnemyState | null = null;
  private waveIndex = 0;
  private status: CombatStatus = "playing";
  private freezeTurns = 0;
  private armorBreak: ArmorBreakState | null = null;

  constructor(waves: EnemyWave[] = FAIRY_TALE_WAVES) {
    if (waves.length === 0) {
      throw new Error("CombatSystem requires at least one enemy wave.");
    }

    this.waves = waves.map(cloneWave);
    this.reset();
  }

  getState(): CombatState {
    return {
      player: { ...this.player },
      enemy: this.enemy ? { ...this.enemy } : null,
      wave: this.waveIndex + 1,
      waveIndex: this.waveIndex,
      status: this.status,
      freezeTurns: this.freezeTurns,
      armorBreak: this.armorBreak ? { ...this.armorBreak } : null,
    };
  }

  applyPlayerMoveResult(summary: CombatMoveSummary): CombatEvent[] {
    const events: CombatEvent[] = [];

    if (this.status !== "playing" || summary.wasPlayerMove === false) {
      return events;
    }

    const totalCleared = sanitizeAmount(summary.totalCleared);
    if (totalCleared <= 0 || !this.enemy) {
      return events;
    }

    const enemy = this.enemy;
    const damage = this.calculateEnemyDamage(totalCleared * 2);
    enemy.hp = clampMin(roundCombatNumber(enemy.hp - damage), 0);
    events.push({ type: "enemyDamaged", amount: damage, enemyHp: enemy.hp });

    if (enemy.hp <= 0) {
      this.handleEnemyDefeated(enemy, events);
      return events;
    }

    events.push(...this.endPlayerTurn());

    return events;
  }

  applyDirectDamage(amount: number): CombatEvent[] {
    const events: CombatEvent[] = [];

    if (this.status !== "playing" || !this.enemy) {
      return events;
    }

    const safeAmount = sanitizeAmount(amount);
    if (safeAmount <= 0) {
      return events;
    }

    const enemy = this.enemy;
    const damage = this.calculateEnemyDamage(safeAmount);
    enemy.hp = clampMin(roundCombatNumber(enemy.hp - damage), 0);
    events.push({ type: "enemyDamaged", amount: damage, enemyHp: enemy.hp });

    if (enemy.hp <= 0) {
      this.handleEnemyDefeated(enemy, events);
    }

    return events;
  }

  endPlayerTurn(): CombatEvent[] {
    const events: CombatEvent[] = [];

    if (this.status !== "playing" || !this.enemy) {
      return events;
    }

    this.advanceEnemyAttack(events);
    this.tickEnemyEffects();

    if (this.player.hp <= 0 && this.status === "playing") {
      this.status = "lost";
      events.push({ type: "gameLost" });
    }

    return events;
  }

  freezeEnemy(turns: number): void {
    this.freezeTurns = Math.max(this.freezeTurns, Math.floor(sanitizeAmount(turns)));
  }

  addShield(amount: number): void {
    this.player.shield = roundCombatNumber(this.player.shield + sanitizeAmount(amount));
  }

  healPlayer(amount: number): void {
    this.healPlayerInternal(amount);
  }

  applyArmorBreak(turns: number, multiplier: number): void {
    const safeTurns = Math.floor(sanitizeAmount(turns));
    const safeMultiplier = Number.isFinite(multiplier) ? Math.max(multiplier, 0) : 1;

    if (safeTurns <= 0 || safeMultiplier <= 0) {
      this.armorBreak = null;
      return;
    }

    this.armorBreak = {
      turns: safeTurns,
      multiplier: safeMultiplier,
    };
  }

  reset(): void {
    this.player = createInitialPlayer();
    this.waveIndex = 0;
    this.status = "playing";
    this.startCurrentWave();
  }

  private handleEnemyDefeated(enemy: EnemyState, events: CombatEvent[]): void {
    events.push({
      type: "enemyDefeated",
      wave: this.waveIndex + 1,
      enemyId: enemy.id,
    });

    if (this.waveIndex >= this.waves.length - 1) {
      this.status = "won";
      this.clearEnemyEffects();
      events.push({ type: "gameWon" });
      return;
    }

    this.waveIndex++;
    this.startCurrentWave();
    events.push({
      type: "waveStarted",
      wave: this.waveIndex + 1,
      enemyId: this.enemy?.id ?? "",
    });

    const healed = this.healPlayerInternal(10);
    events.push({
      type: "playerHealed",
      amount: healed,
      playerHp: this.player.hp,
    });
  }

  private advanceEnemyAttack(events: CombatEvent[]): void {
    if (!this.enemy || this.enemy.attackInterval <= 0 || this.freezeTurns > 0) {
      return;
    }

    this.enemy.attackCounter++;
    events.push({
      type: "enemyAttackCounterChanged",
      current: this.enemy.attackCounter,
      max: this.enemy.attackInterval,
    });

    if (this.enemy.attackCounter < this.enemy.attackInterval) {
      return;
    }

    const hpDamage = this.damagePlayer(this.enemy.damage);
    events.push({
      type: "playerDamaged",
      amount: hpDamage,
      playerHp: this.player.hp,
    });

    this.enemy.attackCounter = 0;
    events.push({
      type: "enemyAttackCounterChanged",
      current: this.enemy.attackCounter,
      max: this.enemy.attackInterval,
    });
  }

  private calculateEnemyDamage(baseDamage: number): number {
    const multiplier = this.armorBreak ? this.armorBreak.multiplier : 1;
    return roundCombatNumber(baseDamage * multiplier);
  }

  private damagePlayer(amount: number): number {
    const incomingDamage = sanitizeAmount(amount);
    const shieldBlocked = Math.min(this.player.shield, incomingDamage);
    this.player.shield = roundCombatNumber(this.player.shield - shieldBlocked);

    const hpDamage = roundCombatNumber(incomingDamage - shieldBlocked);
    this.player.hp = clampMin(roundCombatNumber(this.player.hp - hpDamage), 0);
    return hpDamage;
  }

  private healPlayerInternal(amount: number): number {
    const before = this.player.hp;
    this.player.hp = Math.min(
      this.player.maxHp,
      roundCombatNumber(this.player.hp + sanitizeAmount(amount)),
    );

    return roundCombatNumber(this.player.hp - before);
  }

  private tickEnemyEffects(): void {
    if (this.freezeTurns > 0) {
      this.freezeTurns--;
    }

    if (!this.armorBreak) {
      return;
    }

    this.armorBreak.turns--;
    if (this.armorBreak.turns <= 0) {
      this.armorBreak = null;
    }
  }

  private startCurrentWave(): void {
    const wave = this.waves[this.waveIndex];
    if (!wave) {
      this.enemy = null;
      return;
    }

    this.enemy = {
      id: wave.id,
      name: wave.name,
      maxHp: wave.hp,
      hp: wave.hp,
      attackInterval: wave.attackInterval,
      attackCounter: 0,
      damage: wave.damage,
    };

    if (wave.endless) {
      this.enemy.endless = true;
    }

    this.clearEnemyEffects();
  }

  private clearEnemyEffects(): void {
    this.freezeTurns = 0;
    this.armorBreak = null;
  }
}

function createInitialPlayer(): PlayerState {
  return {
    maxHp: PLAYER_MAX_HP,
    hp: PLAYER_MAX_HP,
    shield: 0,
  };
}

function cloneWave(wave: EnemyWave): EnemyWave {
  const clone: EnemyWave = {
    id: wave.id,
    name: wave.name,
    hp: wave.hp,
    attackInterval: wave.attackInterval,
    damage: wave.damage,
  };

  if (wave.endless) {
    clone.endless = true;
  }

  return clone;
}

function sanitizeAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.max(amount, 0) : 0;
}

function clampMin(value: number, min: number): number {
  return Math.max(value, min);
}

function roundCombatNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}
