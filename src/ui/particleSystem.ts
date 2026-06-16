import { getParticlePreset } from "./particleConfig.ts";
import type {
  CharacterParticleEvent,
  Particle,
  ParticleBase,
  ParticleAura,
  ParticleBurst,
  ParticleEmitContext,
  ParticleEmitResult,
  ParticleFlash,
  ParticlePoint,
  ParticlePreset,
  ParticlePrimitiveInput,
  ParticleProjectile,
  ParticleSource,
  ParticleTarget,
} from "./particleTypes.ts";

export const MAX_ACTIVE_PARTICLES = 80;

export interface ParticleSystemOptions {
  maxActiveParticles?: number;
  now?: () => number;
}

export class ParticleSystem {
  private readonly maxActiveParticles: number;
  private readonly getNow: () => number;
  private activeParticles: Particle[] = [];
  private sequence = 0;

  constructor(options: ParticleSystemOptions = {}) {
    this.maxActiveParticles = Math.max(
      0,
      options.maxActiveParticles ?? MAX_ACTIVE_PARTICLES,
    );
    this.getNow = options.now ?? (() => Date.now());
  }

  getActiveParticles(): Particle[] {
    return [...this.activeParticles];
  }

  clear(): Particle[] {
    const removed = this.activeParticles;
    this.activeParticles = [];
    return removed;
  }

  cleanupExpired(now = this.getNow()): Particle[] {
    const removed: Particle[] = [];
    this.activeParticles = this.activeParticles.filter((particle) => {
      if (particle.expiresAt <= now) {
        removed.push(particle);
        return false;
      }

      return true;
    });

    return removed;
  }

  emitProjectile(input: ParticlePrimitiveInput): ParticleEmitResult {
    const now = input.now ?? this.getNow();
    const preset = getParticlePreset(input.key);
    const from = input.from ?? point(0, 0);
    const to = input.to ?? from;

    return this.emit(
      [
        this.createProjectile({
          preset,
          from,
          to,
          now,
          input,
          source: input.source ?? "character",
        }),
      ],
      now,
    );
  }

  emitBurst(input: ParticlePrimitiveInput): ParticleEmitResult {
    const now = input.now ?? this.getNow();
    const preset = getParticlePreset(input.key);
    const position = input.position ?? input.to ?? point(0, 0);

    return this.emit(
      [
        this.createBurst({
          preset,
          position,
          now,
          input,
          source: input.source ?? "character",
        }),
      ],
      now,
    );
  }

  emitAura(input: ParticlePrimitiveInput): ParticleEmitResult {
    const now = input.now ?? this.getNow();
    const preset = getParticlePreset(input.key);
    const position = input.position ?? input.from ?? point(0, 0);
    const target = input.target ?? preset.auraTarget;

    return this.emit(
      [
        this.createAura({
          preset,
          position,
          target,
          now,
          input,
          source: input.source ?? "character",
        }),
      ],
      now,
    );
  }

  emitFlash(input: ParticlePrimitiveInput): ParticleEmitResult {
    const now = input.now ?? this.getNow();
    const preset = getParticlePreset(input.key);
    const position = input.position ?? input.to ?? input.from ?? point(0, 0);

    return this.emit(
      [
        this.createFlash({
          preset,
          position,
          now,
          input,
          source: input.source ?? "character",
        }),
      ],
      now,
    );
  }

  handleBattleVfxKey(
    key: string,
    context: ParticleEmitContext = {},
  ): ParticleEmitResult {
    const now = context.now ?? this.getNow();
    const preset = getParticlePreset(key);
    const particles = this.createPresetParticles(preset, context, now, "battleVfx");

    return this.emit(particles, now);
  }

  handleCharacterRuntimeEvent(
    event: CharacterParticleEvent,
    context: ParticleEmitContext = {},
  ): ParticleEmitResult {
    const now = context.now ?? this.getNow();
    const preset = getParticlePreset(context.vfxKey ?? event.key);
    const from =
      context.from ??
      pointForTarget(event.characterId === "enemy" ? "enemy" : "player", context);
    const to =
      context.to ??
      pointForTarget(event.characterId === "enemy" ? "player" : preset.target, context);
    const impact = context.position ?? to;
    let particles: Particle[] = [];

    switch (event.type) {
      case "spawnParticle":
        particles = [
          this.createFlash({
            preset,
            position: from,
            now,
            input: {},
            source: "character",
          }),
          this.createAura({
            preset,
            position: pointForTarget(preset.auraTarget, context),
            target: preset.auraTarget,
            now,
            input: {},
            source: "character",
          }),
        ];
        break;
      case "emitProjectile":
        particles = [
          this.createProjectile({
            preset,
            from,
            to,
            now,
            input: {},
            source: "character",
          }),
        ];
        break;
      case "hitFrame":
        particles = [
          this.createProjectile({
            preset,
            from,
            to,
            now,
            input: { durationMs: Math.min(220, preset.durationMs) },
            source: "character",
          }),
          this.createBurst({
            preset,
            position: impact,
            now,
            input: {},
            source: "character",
          }),
          this.createFlash({
            preset,
            position: impact,
            now,
            input: {},
            source: "character",
          }),
        ];
        break;
      case "playVfx":
        particles = this.createPresetParticles(preset, context, now, "character");
        break;
      case "cameraShake":
        particles = [];
        break;
    }

    return this.emit(particles, now);
  }

  private createPresetParticles(
    preset: ParticlePreset,
    context: ParticleEmitContext,
    now: number,
    source: ParticleSource,
  ): Particle[] {
    const from =
      context.from ??
      (preset.target === "player"
        ? context.battleCenter ?? point(0, 0)
        : context.playerCenter ?? context.battleCenter ?? point(0, 0));
    const to = context.to ?? pointForTarget(preset.target, context);
    const impact = context.position ?? to;
    const particles: Particle[] = [];

    if (preset.projectile) {
      particles.push(
        this.createProjectile({
          preset,
          from,
          to,
          now,
          input: {},
          source,
        }),
      );
    }

    if (preset.burst) {
      particles.push(
        this.createBurst({
          preset,
          position: impact,
          now,
          input: {},
          source,
        }),
      );
    }

    if (preset.flash) {
      particles.push(
        this.createFlash({
          preset,
          position: impact,
          now,
          input: {},
          source,
        }),
      );
    }

    if (preset.aura) {
      particles.push(
        this.createAura({
          preset,
          position: pointForTarget(preset.auraTarget, context),
          target: preset.auraTarget,
          now,
          input: {},
          source,
        }),
      );
    }

    return particles.slice(0, preset.maxParticles);
  }

  private emit(particles: Particle[], now: number): ParticleEmitResult {
    const removed = this.cleanupExpired(now);

    this.activeParticles.push(...particles);

    while (this.activeParticles.length > this.maxActiveParticles) {
      const removeIndex = findLowestPriorityOldestIndex(this.activeParticles);
      const [removedParticle] = this.activeParticles.splice(removeIndex, 1);

      if (removedParticle) {
        removed.push(removedParticle);
      }
    }

    const activeIds = new Set(this.activeParticles.map((particle) => particle.id));
    const created = particles.filter((particle) => activeIds.has(particle.id));

    return {
      created,
      removed,
      active: this.getActiveParticles(),
    };
  }

  private createProjectile(input: {
    preset: ParticlePreset;
    from: ParticlePoint;
    to: ParticlePoint;
    now: number;
    input: Partial<ParticlePrimitiveInput>;
    source: ParticleSource;
  }): ParticleProjectile {
    const durationMs = input.input.durationMs ?? input.preset.durationMs;

    return {
      ...this.createBase(input.preset, "projectile", input.now, durationMs, input),
      from: clonePoint(input.from),
      to: clonePoint(input.to),
    };
  }

  private createBurst(input: {
    preset: ParticlePreset;
    position: ParticlePoint;
    now: number;
    input: Partial<ParticlePrimitiveInput>;
    source: ParticleSource;
  }): ParticleBurst {
    const durationMs = input.input.durationMs ?? input.preset.durationMs;

    return {
      ...this.createBase(input.preset, "burst", input.now, durationMs, input),
      position: clonePoint(input.position),
      count: Math.max(1, input.input.count ?? input.preset.burstCount),
    };
  }

  private createAura(input: {
    preset: ParticlePreset;
    position: ParticlePoint;
    target: ParticleTarget;
    now: number;
    input: Partial<ParticlePrimitiveInput>;
    source: ParticleSource;
  }): ParticleAura {
    const durationMs = input.input.durationMs ?? input.preset.durationMs;

    return {
      ...this.createBase(input.preset, "aura", input.now, durationMs, input),
      target: input.target,
      position: clonePoint(input.position),
    };
  }

  private createFlash(input: {
    preset: ParticlePreset;
    position: ParticlePoint;
    now: number;
    input: Partial<ParticlePrimitiveInput>;
    source: ParticleSource;
  }): ParticleFlash {
    const durationMs = input.input.durationMs ?? input.preset.durationMs;

    return {
      ...this.createBase(input.preset, "flash", input.now, durationMs, input),
      position: clonePoint(input.position),
    };
  }

  private createBase<Type extends Particle["type"]>(
    preset: ParticlePreset,
    type: Type,
    now: number,
    durationMs: number,
    input: { input: Partial<ParticlePrimitiveInput>; source: ParticleSource },
  ): ParticleBase<Type> {
    const size = input.input.size ?? preset.size;
    const key = preset.key;

    return {
      id: this.createId(type, key),
      type,
      key,
      color: input.input.color ?? preset.color,
      tone: preset.tone,
      durationMs,
      size,
      createdAt: now,
      expiresAt: now + durationMs,
      priority: preset.priority,
      className: preset.cssClass,
      source: input.source,
    };
  }

  private createId(type: Particle["type"], key: string): string {
    this.sequence += 1;
    return `particle-${type}-${key}-${this.sequence}`;
  }
}

function pointForTarget(
  target: ParticleTarget,
  context: ParticleEmitContext,
): ParticlePoint {
  switch (target) {
    case "player":
      return context.playerCenter ?? context.battleCenter ?? point(0, 0);
    case "enemy":
      return context.enemyHitPoint ?? context.battleCenter ?? point(0, 0);
    case "board":
    case "battle":
      return context.battleCenter ?? point(0, 0);
  }
}

function findLowestPriorityOldestIndex(particles: readonly Particle[]): number {
  let selectedIndex = 0;

  for (let index = 1; index < particles.length; index++) {
    const selected = particles[selectedIndex];
    const candidate = particles[index];

    if (!selected || !candidate) {
      continue;
    }

    if (
      candidate.priority < selected.priority ||
      (candidate.priority === selected.priority &&
        candidate.createdAt < selected.createdAt)
    ) {
      selectedIndex = index;
    }
  }

  return selectedIndex;
}

function point(x: number, y: number): ParticlePoint {
  return { x, y };
}

function clonePoint(value: ParticlePoint): ParticlePoint {
  return { x: value.x, y: value.y };
}
