import type { BoardEffectRequest } from "../core/skillTypes.ts";
import type {
  SkillVfxAnchor,
  SkillVfxIntensity,
  SkillVfxLayerInput,
  SkillVfxLayerModel,
  SkillVfxPresentation,
} from "./skillVfxTypes.ts";

const SKILL_DURATION_MS = 700;
const ULTIMATE_DURATION_MS = 1050;
const FALLBACK_DURATION_MS = 620;
const BOARD_SIZE = 8;

type SkillVfxDefinition = Omit<SkillVfxPresentation, "key">;
type SkillVfxRenderScope = "board" | "battle";

const FALLBACK_PRESENTATION: SkillVfxDefinition = {
  label: "技能闪光",
  level: "fallback",
  tone: "generic",
  cssClass: "generic-vfx-flash",
  durationMs: FALLBACK_DURATION_MS,
  combatHint: "board",
};

const BATTLE_VFX_DEFINITIONS = {
  red_skill_slash: {
    label: "火焰横扫",
    level: "skill",
    tone: "red",
    cssClass: "red-skill-slash",
    durationMs: SKILL_DURATION_MS,
    combatHint: "board",
  },
  red_ultimate_spin: {
    label: "火焰旋风",
    level: "ultimate",
    tone: "red",
    cssClass: "red-ultimate-spin",
    durationMs: ULTIMATE_DURATION_MS,
    combatHint: "board",
  },
  blue_skill_freeze: {
    label: "寒霜冻结",
    level: "skill",
    tone: "blue",
    cssClass: "blue-skill-freeze",
    durationMs: SKILL_DURATION_MS,
    combatHint: "attack",
  },
  blue_ultimate_icefall: {
    label: "冰锥坠落",
    level: "ultimate",
    tone: "blue",
    cssClass: "blue-ultimate-icefall",
    durationMs: ULTIMATE_DURATION_MS,
    combatHint: "attack",
  },
  yellow_skill_chain: {
    label: "星辉连闪",
    level: "skill",
    tone: "yellow",
    cssClass: "yellow-skill-chain",
    durationMs: SKILL_DURATION_MS,
    combatHint: "board",
  },
  yellow_ultimate_meteor: {
    label: "星愿流星雨",
    level: "ultimate",
    tone: "yellow",
    cssClass: "yellow-ultimate-meteor",
    durationMs: ULTIMATE_DURATION_MS,
    combatHint: "board",
  },
  green_skill_shield: {
    label: "森林护盾",
    level: "skill",
    tone: "green",
    cssClass: "green-skill-shield",
    durationMs: SKILL_DURATION_MS,
    combatHint: "player",
  },
  green_ultimate_bloom: {
    label: "自然祝福",
    level: "ultimate",
    tone: "green",
    cssClass: "green-ultimate-bloom",
    durationMs: ULTIMATE_DURATION_MS,
    combatHint: "player",
  },
  purple_skill_bomb: {
    label: "秘法爆弹",
    level: "skill",
    tone: "purple",
    cssClass: "purple-skill-bomb",
    durationMs: SKILL_DURATION_MS,
    combatHint: "board",
  },
  purple_ultimate_magic_circle: {
    label: "月蚀法阵",
    level: "ultimate",
    tone: "purple",
    cssClass: "purple-ultimate-magic-circle",
    durationMs: ULTIMATE_DURATION_MS,
    combatHint: "board",
  },
  orange_skill_hammer: {
    label: "勇者重锤",
    level: "skill",
    tone: "orange",
    cssClass: "orange-skill-hammer",
    durationMs: SKILL_DURATION_MS,
    combatHint: "enemy",
  },
  orange_ultimate_judgement: {
    label: "破甲审判",
    level: "ultimate",
    tone: "orange",
    cssClass: "orange-ultimate-judgement",
    durationMs: ULTIMATE_DURATION_MS,
    combatHint: "enemy",
  },
} as const satisfies Record<string, SkillVfxDefinition>;

export function getBattleVfxPresentation(key: string): SkillVfxPresentation {
  const definitions: Record<string, SkillVfxDefinition> =
    BATTLE_VFX_DEFINITIONS;
  const definition = definitions[key] ?? FALLBACK_PRESENTATION;

  return {
    key,
    ...definition,
  };
}

export function getBattleVfxCssClass(key: string): string {
  return getBattleVfxPresentation(key).cssClass;
}

export function getScreenShakeClass(
  intensity: SkillVfxIntensity | undefined,
): string {
  switch (intensity) {
    case "small":
      return "shake-small";
    case "medium":
      return "shake-medium";
    case "large":
      return "shake-large";
    default:
      return "";
  }
}

export function getScreenShakeClassFromKeys(keys: readonly string[]): string {
  if (keys.includes("screenShake:large")) {
    return getScreenShakeClass("large");
  }

  if (keys.includes("screenShake:medium")) {
    return getScreenShakeClass("medium");
  }

  if (keys.includes("screenShake:small")) {
    return getScreenShakeClass("small");
  }

  return "";
}

export function getSkillDisplayText(
  keys: readonly string[],
  fallbackText: string | undefined,
  fallbackLevel: "skill" | "ultimate" | undefined,
): string | undefined {
  const battleKey = getBattleVfxKey(keys);

  if (battleKey) {
    return getBattleVfxPresentation(battleKey).label;
  }

  if (fallbackText) {
    return fallbackText;
  }

  if (fallbackLevel === "ultimate") {
    return "大招触发";
  }

  if (fallbackLevel === "skill") {
    return "技能触发";
  }

  return undefined;
}

export function getSkillVfxDurationMs(input: SkillVfxLayerInput): number {
  return buildSkillVfxLayerModel(input)?.presentation.durationMs ?? 0;
}

export function buildSkillVfxLayerModel(
  input: SkillVfxLayerInput,
): SkillVfxLayerModel | null {
  const battleKey = getBattleVfxKey(input.state.lastVfxKeys);

  if (!battleKey) {
    return null;
  }

  const presentation = getBattleVfxPresentation(battleKey);
  const level =
    input.state.lastSkillLevel ??
    (presentation.level === "fallback" ? "fallback" : presentation.level);
  const text =
    getSkillDisplayText(
      input.state.lastVfxKeys,
      input.state.lastSkillText,
      input.state.lastSkillLevel,
    ) ?? presentation.label;
  const comboText = getComboDisplayText(input.state.lastComboCount);
  const shakeClass = getScreenShakeClassFromKeys(input.state.lastVfxKeys);
  const classNames = [
    "skill-vfx-layer",
    presentation.cssClass,
    `skill-vfx-${level}`,
    `skill-vfx-${presentation.tone}`,
    shakeClass,
  ].filter(Boolean);
  const model: SkillVfxLayerModel = {
    presentation,
    text,
    level,
    classes: classNames.join(" "),
    style: createAnchorStyle(findVfxAnchor(input.events)),
    shakeClass,
  };

  if (comboText) {
    model.comboText = comboText;
  }

  return model;
}

export function renderSkillVfxLayer(
  input: SkillVfxLayerInput,
  scope: SkillVfxRenderScope = "board",
): string {
  const model = buildSkillVfxLayerModel(input);

  if (!model) {
    return "";
  }

  const boardOnlySpans =
    scope === "board"
      ? `
      <span class="skill-vfx-board-glow"></span>
      <span class="skill-vfx-row-sweep"></span>
      <span class="skill-vfx-fall fall-1"></span>
      <span class="skill-vfx-fall fall-2"></span>
      <span class="skill-vfx-fall fall-3"></span>
      <span class="skill-vfx-fall fall-4"></span>
      <span class="skill-vfx-chain-dot dot-1"></span>
      <span class="skill-vfx-chain-dot dot-2"></span>
      <span class="skill-vfx-chain-dot dot-3"></span>
      <span class="skill-vfx-chain-dot dot-4"></span>`
      : "";

  return `
    <div
      class="${model.classes}"
      style="${model.style}"
      data-vfx-key="${escapeAttribute(model.presentation.key)}"
      data-vfx-level="${model.level}"
      aria-hidden="true"
    >
      ${boardOnlySpans}
      <span class="skill-vfx-core"></span>
      <span class="skill-vfx-beam"></span>
      <span class="skill-vfx-impact"></span>
      <span class="skill-vfx-ring"></span>
      <span class="skill-vfx-burst burst-1"></span>
      <span class="skill-vfx-burst burst-2"></span>
      <span class="skill-vfx-burst burst-3"></span>
      <span class="skill-vfx-burst burst-4"></span>
      <span class="skill-vfx-caption">${escapeHtml(model.text)}</span>
      ${model.comboText ? `<span class="skill-vfx-combo">${escapeHtml(model.comboText)}</span>` : ""}
    </div>
  `;
}

export function mountSkillVfxLayer(
  root: HTMLElement,
  input: SkillVfxLayerInput,
): { durationMs: number; cleanup: () => void } | null {
  const model = buildSkillVfxLayerModel(input);
  const stage = root.querySelector<HTMLElement>(".board-stage");

  if (!model || !stage) {
    return null;
  }

  const layer = createSkillVfxElement(input, "board");

  if (!layer) {
    return null;
  }

  const boardClasses = [
    "skill-vfx-active",
    model.presentation.cssClass,
    `skill-vfx-${model.level}`,
    model.shakeClass,
  ].filter(Boolean);
  const battleClasses = [
    "battle-vfx-active",
    `battle-${model.presentation.cssClass}`,
    `battle-vfx-${model.presentation.tone}`,
    model.shakeClass,
  ].filter(Boolean);
  const combatClasses = [
    "combat-vfx-active",
    `combat-${model.presentation.cssClass}`,
    `combat-vfx-${model.presentation.combatHint}`,
  ];
  const battleZone = root.querySelector<HTMLElement>(".battle-zone");
  const combatPanel = root.querySelector<HTMLElement>(".combat-info-panel");
  const battleVfxLayer = root.querySelector<HTMLElement>(".battle-vfx-layer");
  const battleLayer = battleVfxLayer
    ? createSkillVfxElement(input, "battle")
    : null;

  stage.classList.add(...boardClasses);
  battleZone?.classList.add(...battleClasses);
  combatPanel?.classList.add(...combatClasses);
  stage.append(layer);
  if (battleLayer) {
    battleLayer.classList.add("battle-skill-vfx-layer");
    battleVfxLayer?.append(battleLayer);
  }

  return {
    durationMs: model.presentation.durationMs,
    cleanup: () => {
      layer.remove();
      battleLayer?.remove();
      stage.classList.remove(...boardClasses);
      battleZone?.classList.remove(...battleClasses);
      combatPanel?.classList.remove(...combatClasses);
    },
  };
}

function createSkillVfxElement(
  input: SkillVfxLayerInput,
  scope: SkillVfxRenderScope,
): HTMLElement | null {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderSkillVfxLayer(input, scope).trim();
  const layer = wrapper.firstElementChild;

  return layer instanceof HTMLElement ? layer : null;
}

function getBattleVfxKey(keys: readonly string[]): string | undefined {
  return keys.find(
    (key) =>
      !key.startsWith("screenShake:") &&
      !key.startsWith("skillText:") &&
      !key.startsWith("combo:"),
  );
}

function getComboDisplayText(chainCount: number): string | undefined {
  if (chainCount >= 4) {
    return "AMAZING";
  }

  if (chainCount > 1) {
    return `${chainCount} COMBO`;
  }

  return undefined;
}

function findVfxAnchor(
  events: SkillVfxLayerInput["events"],
): SkillVfxAnchor {
  for (const event of events ?? []) {
    if (event.type !== "boardEffectRequested") {
      continue;
    }

    const anchor = anchorForBoardEffect(event.request);
    if (anchor) {
      return anchor;
    }
  }

  return {};
}

function anchorForBoardEffect(
  request: BoardEffectRequest,
): SkillVfxAnchor | null {
  switch (request.type) {
    case "clearRow":
      return { row: request.row };
    case "clearArea":
      return { x: request.center.x, y: request.center.y };
    case "clearRandom":
      return null;
  }
}

function createAnchorStyle(anchor: SkillVfxAnchor): string {
  const vars = [
    `--skill-vfx-row: ${percentFromBoardIndex(anchor.row ?? 3.5)}`,
    `--skill-vfx-x: ${percentFromBoardIndex(anchor.x ?? 3.5)}`,
    `--skill-vfx-y: ${percentFromBoardIndex(anchor.y ?? 3.5)}`,
  ];

  return vars.join("; ");
}

function percentFromBoardIndex(value: number): string {
  const clamped = Math.max(0, Math.min(BOARD_SIZE - 1, value));
  return `${((clamped + 0.5) / BOARD_SIZE) * 100}%`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
