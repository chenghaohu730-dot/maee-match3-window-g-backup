import type {
  CharacterAnchorName,
  CharacterAnimationRuntimeEvent,
  CharacterId,
} from "./characterAnimationTypes.ts";
import { ParticleSystem } from "./particleSystem.ts";
import type {
  CharacterParticleLayerOptions,
  Particle,
  ParticleEmitContext,
  ParticleEmitResult,
  ParticlePoint,
} from "./particleTypes.ts";

export interface ParticleLayerMount {
  system: ParticleSystem;
  handleCharacterEvent: (
    event: CharacterAnimationRuntimeEvent,
    options?: CharacterParticleLayerOptions,
  ) => ParticleEmitResult;
  handleBattleVfxKey: (key: string) => ParticleEmitResult;
  cleanup: () => void;
}

export function mountParticleLayer(
  root: HTMLElement,
  system = new ParticleSystem(),
): ParticleLayerMount {
  return new DomParticleLayer(root, system);
}

class DomParticleLayer implements ParticleLayerMount {
  private readonly elements = new Map<string, HTMLElement>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly root: HTMLElement,
    readonly system: ParticleSystem,
  ) {}

  handleCharacterEvent(
    event: CharacterAnimationRuntimeEvent,
    options: CharacterParticleLayerOptions = {},
  ): ParticleEmitResult {
    if (event.type === "cameraShake") {
      this.triggerShake(event.key.includes("ultimate") ? "large" : "medium");
    }

    const context = this.createCharacterContext(event, options);
    const result = this.system.handleCharacterRuntimeEvent(event, context);

    this.syncResult(result);
    return result;
  }

  handleBattleVfxKey(key: string): ParticleEmitResult {
    const result = this.system.handleBattleVfxKey(key, this.createBaseContext());

    this.syncResult(result);
    return result;
  }

  cleanup(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.timers.clear();

    for (const element of this.elements.values()) {
      element.remove();
    }

    this.elements.clear();
    this.system.clear();
  }

  private syncResult(result: ParticleEmitResult): void {
    for (const particle of result.removed) {
      this.removeParticle(particle.id);
    }

    this.renderParticles(result.created);
  }

  private renderParticles(particles: readonly Particle[]): void {
    const layer = this.getLayer();

    if (!layer) {
      return;
    }

    for (const particle of particles) {
      const element = document.createElement("span");
      element.className = createParticleClassName(particle);
      element.dataset.particleId = particle.id;
      element.dataset.particleKey = particle.key;
      element.dataset.particleType = particle.type;
      applyParticleStyle(element, particle);
      layer.append(element);
      this.elements.set(particle.id, element);

      const timer = setTimeout(() => {
        this.removeParticle(particle.id);
        this.system.cleanupExpired(Date.now());
      }, particle.durationMs + 120);
      this.timers.set(particle.id, timer);
    }
  }

  private removeParticle(id: string): void {
    const timer = this.timers.get(id);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    this.elements.get(id)?.remove();
    this.elements.delete(id);
  }

  private createCharacterContext(
    event: CharacterAnimationRuntimeEvent,
    options: CharacterParticleLayerOptions,
  ): ParticleEmitContext {
    const context = this.createBaseContext();
    const from = this.resolveEventPoint(event);
    const to =
      event.characterId === "enemy"
        ? this.resolveCharacterAnchor("yizai", "center")
        : this.resolveCharacterAnchor("enemy", "enemyHitPoint");

    context.from = from;
    context.to = to;
    context.position = event.type === "spawnParticle" ? from : to;

    if (options.vfxKey) {
      context.vfxKey = options.vfxKey;
    }

    return context;
  }

  private createBaseContext(): ParticleEmitContext {
    return {
      playerCenter: this.resolveCharacterAnchor("yizai", "center"),
      enemyHitPoint: this.resolveCharacterAnchor("enemy", "enemyHitPoint"),
      battleCenter: this.resolveBattleCenter(),
    };
  }

  private resolveEventPoint(
    event: CharacterAnimationRuntimeEvent,
  ): ParticlePoint {
    if (event.worldPosition) {
      const converted = this.viewportToLayerPoint(event.worldPosition);

      if (converted) {
        return converted;
      }
    }

    return this.resolveCharacterAnchor(event.characterId, event.anchor ?? "center");
  }

  private resolveCharacterAnchor(
    characterId: CharacterId,
    anchorName: CharacterAnchorName = "center",
  ): ParticlePoint {
    const layer = this.getLayer();
    const element = this.root.querySelector<HTMLElement>(
      `.character-sprite[data-character-id="${characterId}"]`,
    );

    if (!layer || !element) {
      return this.resolveBattleCenter();
    }

    const anchor =
      readAnchorFromElement(element, anchorName) ??
      readAnchorFromElement(element, "center") ??
      { x: 0.5, y: 0.5 };
    const layerRect = layer.getBoundingClientRect();
    const rect = element.getBoundingClientRect();

    return {
      x: rect.left - layerRect.left + rect.width * anchor.x,
      y: rect.top - layerRect.top + rect.height * anchor.y,
    };
  }

  private resolveBattleCenter(): ParticlePoint {
    const layer = this.getLayer();
    const stage = this.root.querySelector<HTMLElement>(".battle-stage");

    if (!layer) {
      return { x: 0, y: 0 };
    }

    const layerRect = layer.getBoundingClientRect();

    if (!stage) {
      return {
        x: layerRect.width / 2,
        y: layerRect.height / 2,
      };
    }

    const stageRect = stage.getBoundingClientRect();

    return {
      x: stageRect.left - layerRect.left + stageRect.width / 2,
      y: stageRect.top - layerRect.top + stageRect.height / 2,
    };
  }

  private viewportToLayerPoint(point: ParticlePoint): ParticlePoint | null {
    const layer = this.getLayer();

    if (!layer) {
      return null;
    }

    const rect = layer.getBoundingClientRect();

    return {
      x: point.x - rect.left,
      y: point.y - rect.top,
    };
  }

  private triggerShake(intensity: "medium" | "large"): void {
    const className = intensity === "large" ? "shake-large" : "shake-medium";
    const targets = [
      this.root.querySelector<HTMLElement>(".battle-zone"),
      this.root.querySelector<HTMLElement>(".battle-vfx-layer"),
    ].filter((target): target is HTMLElement => target !== null);

    for (const target of targets) {
      target.classList.add(className);
      setTimeout(() => {
        target.classList.remove(className);
      }, intensity === "large" ? 520 : 360);
    }
  }

  private getLayer(): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(".battle-vfx-layer");
  }
}

function readAnchorFromElement(
  element: HTMLElement,
  anchorName: CharacterAnchorName,
): ParticlePoint | null {
  const key = toKebab(anchorName);
  const x = Number(element.getAttribute(`data-anchor-${key}-x`));
  const y = Number(element.getAttribute(`data-anchor-${key}-y`));

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function applyParticleStyle(element: HTMLElement, particle: Particle): void {
  const start = particle.type === "projectile" ? particle.from : particle.position;
  const end = particle.type === "projectile" ? particle.to : start;
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  element.style.setProperty("--particle-x", `${start.x}px`);
  element.style.setProperty("--particle-y", `${start.y}px`);
  element.style.setProperty("--particle-dx", `${dx}px`);
  element.style.setProperty("--particle-dy", `${dy}px`);
  element.style.setProperty("--particle-color", particle.color);
  element.style.setProperty("--particle-size", `${particle.size}px`);
  element.style.setProperty("--particle-duration", `${particle.durationMs}ms`);

  if (particle.type === "burst") {
    element.style.setProperty("--particle-count", String(particle.count));
  }
}

function createParticleClassName(particle: Particle): string {
  return [
    "particle-effect",
    `particle-${particle.type}`,
    `particle-tone-${particle.tone}`,
    particle.className,
    `particle-key-${sanitizeClassName(particle.key)}`,
  ].join(" ");
}

function sanitizeClassName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function toKebab(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
