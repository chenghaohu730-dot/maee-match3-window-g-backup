import type { MatchCell, Piece } from "../core/board.ts";
import type { GameplayEvent, GameplayState } from "../core/gameplayTypes.ts";
import {
  getSkinResource,
  hasImageResource,
  type HeroAnimationState,
  type Match3Skin,
  type SkinAnimation,
} from "../skins/skinTypes.ts";
import type { AssetKey } from "../assets/assetManifest.ts";
import type { PlayerProgress } from "./progressionStore.ts";
import type { ModalKind } from "./sceneState.ts";
import { UNIVERSE_CARDS } from "./sceneState.ts";
import { PHONE_LAYOUT } from "./layout.ts";

export interface GameplayViewModel {
  state: GameplayState;
  pieces: (Piece | null)[];
  selected: MatchCell | null;
  message: string;
  lastEvents: GameplayEvent[];
  progress: PlayerProgress;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  skin: Match3Skin;
}

export interface StartSceneViewModel {
  progress: PlayerProgress;
  modal: ModalKind | null;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  skin: Match3Skin;
}

export interface UniverseSceneViewModel {
  progress: PlayerProgress;
  modal: ModalKind | null;
  skin: Match3Skin;
  fairySkin: Match3Skin;
}

export function renderStartScene(model: StartSceneViewModel): string {
  const { skin } = model;

  return renderPhoneFrame(
    skin,
    `
      <div class="scene start-scene ${skin.sceneClasses.start} ${assetClasses(
        skin,
        "home_bg",
      )}" ${assetAttrs(skin, "home_bg")}>
        <header class="start-hero">
          <div class="hall-label">宇宙大厅</div>
          <div class="game-logo ${assetClasses(
            skin,
            "logo_yizai_match3",
          )}" ${assetAttrs(skin, "logo_yizai_match3")}>
            <h1>亿仔消消战</h1>
          </div>
          <p>选择宇宙，消除蓄力，打穿 6 波挑战。</p>
        </header>

        <div class="start-actions">
          <button class="primary-button start-button ${assetClasses(
            skin,
            "btn_start",
          )}" type="button" data-action="enter-universe" ${assetAttrs(
            skin,
            "btn_start",
          )}>
            开始游戏
          </button>
          <div class="secondary-actions">
            ${renderStartAction(skin, "btn_rank", "排行榜", "show-leaderboard")}
            ${renderStartAction(skin, "btn_points", "积分", "show-points")}
            ${renderStartAction(skin, "btn_exchange", "兑换", "show-exchange")}
            ${renderStartAction(skin, "btn_settings", "设置", "show-settings")}
          </div>
        </div>

        <footer class="start-stat-row">
          <span>最高分 ${model.progress.highestScore}</span>
          <span>积分 ${model.progress.totalPoints}</span>
        </footer>
      </div>
      ${renderModal(model.modal, model.progress, {
        soundEnabled: model.soundEnabled,
        vibrationEnabled: model.vibrationEnabled,
      }, skin)}
    `,
  );
}

export function renderUniverseScene(model: UniverseSceneViewModel): string {
  const { skin } = model;

  return renderPhoneFrame(
    skin,
    `
      <div class="scene universe-scene ${skin.sceneClasses.universe}">
        <header class="universe-header">
          <button class="icon-button" type="button" data-action="back-start" aria-label="返回开始页">
            ←
          </button>
          <h1>选择宇宙</h1>
          <div class="points-pill">积分 ${model.progress.totalPoints}</div>
        </header>

        <div class="universe-track" aria-label="universe cards">
          ${UNIVERSE_CARDS.map((card) =>
            renderUniverseCard(
              card.id,
              card.name,
              card.description,
              model.progress,
              model.fairySkin,
            ),
          ).join("")}
        </div>

        <p class="universe-hint">已解锁宇宙可直接进入；未解锁宇宙需要积分兑换。</p>
      </div>
      ${renderModal(model.modal, model.progress, undefined, skin)}
    `,
  );
}

export function renderGameplayScene(model: GameplayViewModel): string {
  const { state } = model;
  const { skin } = model;

  return renderPhoneFrame(
    skin,
    `
      <div class="scene gameplay-scene ${skin.sceneClasses.gameplay} ${assetClasses(
        skin,
        "ft_gameplay_bg",
      )}" ${assetAttrs(skin, "ft_gameplay_bg")}>
        <header class="game-hud">
          <strong>Wave ${state.wave}/${state.totalWaves}</strong>
          <span>Score ${state.score}</span>
          <button class="icon-button" type="button" aria-label="暂停">Ⅱ</button>
        </header>

        <section class="battle-zone ${assetClasses(
          skin,
          "ft_battle_stage_bg",
        )}" aria-label="battle status" ${assetAttrs(skin, "ft_battle_stage_bg")}>
          <div class="stage-actor stage-actor-hero">
            ${renderMaeePlaceholder(skin, state)}
          </div>
          <div class="stage-vfx-lane">
            <div class="versus-mark">VS</div>
            <div class="stage-hit-flash ${getShakeClass(state)}"></div>
          </div>
          <div class="stage-actor stage-actor-monster">
            ${renderMonsterPlaceholder(skin, state)}
          </div>
        </section>

        ${renderCombatInfoPanel(state)}

        <section class="board-zone">
          <div class="board-stage ${getShakeClass(state)} ${assetClasses(
            skin,
            "ft_board_frame",
          )}" ${assetAttrs(skin, "ft_board_frame")}>
            <div class="board ${assetClasses(
              skin,
              "ft_board_bg",
            )}" aria-label="8 by 8 match board" ${assetAttrs(skin, "ft_board_bg")}>
              ${model.pieces
                .map((piece) => renderPiece(piece, model.selected, skin))
                .join("")}
            </div>
            ${renderBoardFeedback(state)}
            ${renderVfxFallbacks(state, skin)}
          </div>
        </section>

        <footer class="bottom-status">
          <div class="bottom-status-line">
            <span>当前积分 ${model.progress.totalPoints}</span>
            <p>${escapeHtml(model.message)}</p>
            <span>护盾 ${state.playerShield}</span>
          </div>
          <div class="bottom-actions">
            <span>${escapeHtml(formatEventSummary(model.lastEvents))}</span>
            <button class="secondary-button compact" type="button" data-action="return-universe">返回宇宙</button>
          </div>
        </footer>
      </div>

      ${renderResultPanel(state, skin)}
    `,
  );
}

function renderUniverseCard(
  id: string,
  name: string,
  description: string,
  progress: PlayerProgress,
  skin: Match3Skin,
): string {
  const unlocked = progress.unlockedUniverses.includes(id);
  const statusText = unlocked ? "已解锁" : "未解锁";
  const assetKey = getUniverseCardAssetKey(id);

  return `
    <button
      class="universe-card ${unlocked ? "unlocked" : "locked"} ${assetClasses(
        skin,
        assetKey,
      )}"
      type="button"
      data-universe-id="${escapeHtml(id)}"
      ${assetAttrs(skin, assetKey)}
    >
      ${unlocked ? "" : renderLockBadge(skin)}
      <span>${escapeHtml(statusText)}</span>
      <strong>${escapeHtml(name)}</strong>
      <em>${escapeHtml(description)}</em>
    </button>
  `;
}

function renderHpBar(
  label: string,
  current: number,
  max: number,
  variant: "player" | "enemy",
): string {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  return `
    <div class="hp-block">
      <div class="hp-label">
        <span>${escapeHtml(label)}</span>
        <span>${current}/${max}</span>
      </div>
      <div class="hp-track">
        <div class="hp-fill ${variant}" style="width: ${percent}%"></div>
      </div>
    </div>
  `;
}

function renderAttackBar(current: number, max: number): string {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  return `
    <div class="attack-block">
      <div class="hp-label">
        <span>攻击条</span>
        <span>${current}/${max}</span>
      </div>
      <div class="hp-track attack-track">
        <div class="hp-fill attack" style="width: ${percent}%"></div>
      </div>
    </div>
  `;
}

function renderCombatInfoPanel(state: GameplayState): string {
  return `
    <section class="combat-info-panel" aria-label="combat info">
      <div class="combat-bars">
        ${renderHpBar("玩家 HP", state.playerHp, state.playerMaxHp, "player")}
        ${renderHpBar("怪物 HP", state.enemyHp, state.enemyMaxHp, "enemy")}
        ${renderAttackBar(state.enemyAttackCounter, state.enemyAttackInterval)}
      </div>
      <div class="skill-strip" aria-label="recent skill output">
        <div>
          <span>最近技能</span>
          <strong>${escapeHtml(state.lastSkillText ?? "无")}</strong>
        </div>
        <div>
          <span>Combo</span>
          <strong>${state.lastComboCount}</strong>
        </div>
        <div>
          <span>伤害</span>
          <strong>${formatNumber(state.lastDamage)}</strong>
        </div>
      </div>
    </section>
  `;
}

function renderMaeePlaceholder(skin: Match3Skin, state: GameplayState): string {
  const key = getYizaiAssetKey(state);
  const animationState = getYizaiAnimationState(state);
  const animation = skin.animations.yizai[animationState];

  return `
    <div class="maee-placeholder ${assetClasses(
      skin,
      key,
    )} ${animation.fallbackClass}" aria-label="亿仔占位" ${assetAttrs(
      skin,
      key,
    )} ${animationAttrs(animation)}>
      <div class="maee-art-fallback">
        <div class="maee-headband">MAEE</div>
        <div class="maee-brow left"></div>
        <div class="maee-brow right"></div>
        <div class="maee-muzzle">
          <div class="maee-nose"></div>
        </div>
        <strong>亿仔勇者</strong>
      </div>
    </div>
  `;
}

function renderMonsterPlaceholder(
  skin: Match3Skin,
  state: GameplayState,
): string {
  const key = skin.monsterAssets[state.enemyId] ?? "monster_slime_idle";
  const animation = skin.animations.monsters[state.enemyId];

  return `
    <div class="monster-placeholder ${assetClasses(
      skin,
      key,
    )} ${animation?.fallbackClass ?? ""}" ${assetAttrs(skin, key)} ${
      animation ? animationAttrs(animation) : ""
    }>
      <span>怪物</span>
      <strong>${escapeHtml(state.enemyName || state.enemyId)}</strong>
    </div>
  `;
}

function renderPiece(
  piece: Piece | null,
  selected: MatchCell | null,
  skin: Match3Skin,
): string {
  if (!piece) {
    return `<div class="cell empty ${assetClasses(
      skin,
      "ft_grid_cell",
    )}" ${assetAttrs(skin, "ft_grid_cell")}></div>`;
  }

  const isSelected =
    selected?.x === piece.x && selected.y === piece.y ? " selected" : "";
  const assetKey = skin.pieceAssets[piece.type];

  return `
    <button
      class="piece type-${piece.type}${isSelected} ${assetClasses(
        skin,
        assetKey,
      )}"
      type="button"
      data-x="${piece.x}"
      data-y="${piece.y}"
      aria-label="piece ${piece.x},${piece.y}"
      ${assetAttrs(skin, assetKey)}
    >
      <span class="piece-shine"></span>
    </button>
  `;
}

function formatEventSummary(events: GameplayEvent[]): string {
  const lines = events
    .filter(
      (event) =>
        event.type === "combat" ||
        event.type === "scoreGained" ||
        event.type === "boardEffectResolved",
    )
    .slice(-4)
    .map((event) => formatEvent(event))
    .filter(Boolean);

  return lines.at(-1) ?? "等待交换";
}

function formatEvent(event: GameplayEvent): string {
  if (event.type === "scoreGained") {
    return `+${event.amount} score`;
  }

  if (event.type === "boardEffectResolved") {
    return `Board +${event.totalCleared}`;
  }

  if (event.type !== "combat") {
    return "";
  }

  switch (event.event.type) {
    case "enemyDamaged":
      return `Enemy -${event.event.amount}`;
    case "playerDamaged":
      return `Player -${event.event.amount}`;
    case "enemyAttackCounterChanged":
      return `Attack ${event.event.current}/${event.event.max}`;
    case "enemyDefeated":
      return "Enemy defeated";
    case "waveStarted":
      return `Wave ${event.event.wave}`;
    case "playerHealed":
      return `Heal +${event.event.amount}`;
    case "gameWon":
      return "Victory";
    case "gameLost":
      return "Defeat";
  }
}

function renderResultPanel(state: GameplayState, skin: Match3Skin): string {
  if (state.phase !== "won" && state.phase !== "lost") {
    return "";
  }

  const title = state.phase === "won" ? "胜利" : "失败";

  return `
    <section class="result-panel" aria-label="result">
      <div class="result-card ${assetClasses(
        skin,
        "modal_common",
      )}" ${assetAttrs(skin, "modal_common")}>
        <h2>${title}</h2>
        <p>本局分数 ${state.score}</p>
        <button class="primary-button restart-button" type="button">再来一局</button>
        <button class="secondary-button compact" type="button" data-action="return-universe">返回宇宙</button>
      </div>
    </section>
  `;
}

function renderBoardFeedback(state: GameplayState): string {
  const skill = state.lastSkillText
    ? `<div class="skill-pop ${state.lastSkillLevel ?? "skill"}">${escapeHtml(
        state.lastSkillText,
      )}</div>`
    : "";
  const damage =
    state.lastDamage > 0
      ? `<div class="damage-pop">-${formatNumber(state.lastDamage)}</div>`
      : "";
  const combo =
    state.lastComboCount > 0
      ? `<div class="combo-pop">Combo ${state.lastComboCount}</div>`
      : "";

  return `<div class="board-feedback">${skill}${damage}${combo}</div>`;
}

function renderVfxFallbacks(state: GameplayState, skin: Match3Skin): string {
  const vfx = state.lastVfxKeys
    .map((key) => skin.vfxAssets[key])
    .filter((key): key is AssetKey => key !== undefined)
    .slice(-2);

  if (vfx.length === 0) {
    return "";
  }

  return `
    <div class="vfx-layer" aria-hidden="true">
      ${vfx
        .map((key) => {
          const resource = getSkinResource(skin, key);
          const animation = skin.animations.vfx[resource.key.replace("vfx_", "")];
          return `
            <span class="vfx-fallback ${assetClasses(
              skin,
              key,
            )} ${animation?.fallbackClass ?? ""}" ${assetAttrs(skin, key)} ${
              animation ? animationAttrs(animation) : ""
            }>
              ${escapeHtml(resource.fallbackLabel)}
            </span>
          `;
        })
        .join("")}
    </div>
  `;
}

function getShakeClass(state: GameplayState): string {
  if (state.lastVfxKeys.includes("screenShake:large")) {
    return "shake-large";
  }

  if (state.lastVfxKeys.includes("screenShake:medium")) {
    return "shake-medium";
  }

  return "";
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function renderModal(
  modal: ModalKind | null,
  progress: PlayerProgress,
  settings?: { soundEnabled: boolean; vibrationEnabled: boolean },
  skin?: Match3Skin,
): string {
  if (!modal) {
    return "";
  }

  const content = getModalContent(modal, progress, settings);

  return `
    <div class="modal-backdrop" role="dialog" aria-modal="true">
      <section class="modal-panel ${
        skin ? assetClasses(skin, "modal_common") : ""
      }" ${skin ? assetAttrs(skin, "modal_common") : ""}>
        <h2>${escapeHtml(content.title)}</h2>
        <p>${escapeHtml(content.body)}</p>
        ${content.extra}
        <button class="primary-button compact" type="button" data-action="close-modal">确定</button>
      </section>
    </div>
  `;
}

function getModalContent(
  modal: ModalKind,
  progress: PlayerProgress,
  settings?: { soundEnabled: boolean; vibrationEnabled: boolean },
): { title: string; body: string; extra: string } {
  switch (modal) {
    case "leaderboard":
      return {
        title: "本地排行榜",
        body: `本地最高分：${progress.highestScore}`,
        extra: "",
      };
    case "points":
      return {
        title: "当前积分",
        body: `当前累计积分：${progress.totalPoints}`,
        extra: "",
      };
    case "exchange":
      return {
        title: "宇宙兑换",
        body: "宇宙解锁占位面板，后续可接入积分兑换规则。",
        extra: "",
      };
    case "settings":
      return {
        title: "设置",
        body: "音效 / 震动开关占位。",
        extra: `
          <div class="settings-row">
            <button class="secondary-button" type="button" data-action="toggle-sound">
              音效 ${settings?.soundEnabled === false ? "关" : "开"}
            </button>
            <button class="secondary-button" type="button" data-action="toggle-vibration">
              震动 ${settings?.vibrationEnabled === false ? "关" : "开"}
            </button>
          </div>
        `,
      };
    case "locked":
      return {
        title: "需要积分兑换",
        body: "该宇宙暂未解锁，需要积分兑换。",
        extra: "",
      };
  }
}

function renderPhoneFrame(skin: Match3Skin, content: string): string {
  return `
    <section
      class="phone-frame"
      data-skin-id="${escapeHtml(skin.id)}"
      style="${renderLayoutVars()}"
    >
      ${content}
    </section>
  `;
}

function renderStartAction(
  skin: Match3Skin,
  key: AssetKey,
  label: string,
  action: string,
): string {
  return `
    <button
      class="secondary-button ${assetClasses(skin, key)}"
      type="button"
      data-action="${escapeHtml(action)}"
      ${assetAttrs(skin, key)}
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function renderLockBadge(skin: Match3Skin): string {
  return `
    <i class="lock-badge ${assetClasses(
      skin,
      "universe_lock_icon",
    )}" ${assetAttrs(skin, "universe_lock_icon")}>
      锁
    </i>
  `;
}

function getUniverseCardAssetKey(id: string): AssetKey {
  switch (id) {
    case "fairy-tale":
      return "universe_card_fairy";
    case "work":
      return "universe_card_work";
    case "doors-windows":
      return "universe_card_window";
    default:
      return "universe_card_fairy";
  }
}

function getYizaiAssetKey(state: GameplayState): AssetKey {
  if (state.phase === "lost" || state.playerHp <= 0) {
    return "yizai_hero_hurt";
  }

  if (state.lastSkillLevel === "ultimate") {
    return "yizai_hero_ultimate";
  }

  if (state.lastSkillText) {
    return "yizai_hero_skill";
  }

  if (state.lastDamage > 0) {
    return "yizai_hero_attack";
  }

  return "yizai_hero_idle";
}

function getYizaiAnimationState(state: GameplayState): HeroAnimationState {
  if (state.phase === "lost" || state.playerHp <= 0) {
    return "hurt";
  }

  if (state.lastSkillLevel === "ultimate") {
    return "ultimate";
  }

  if (state.lastSkillText) {
    return "skill";
  }

  if (state.lastDamage > 0) {
    return "attack";
  }

  return "idle";
}

function assetClasses(skin: Match3Skin, key: AssetKey): string {
  const resource = getSkinResource(skin, key);
  const imageClass = hasImageResource(resource) ? "has-image" : "uses-fallback";
  return `${resource.fallbackClass} ${imageClass}`;
}

function assetAttrs(skin: Match3Skin, key: AssetKey): string {
  const resource = getSkinResource(skin, key);
  const imageStyle = hasImageResource(resource)
    ? ` style="--asset-url: url('${escapeAttribute(resource.path)}')"`
    : "";

  return `data-asset-key="${escapeHtml(key)}"${imageStyle}`;
}

function animationAttrs(animation: SkinAnimation): string {
  return [
    `data-animation-id="${escapeHtml(animation.id)}"`,
    `data-frame-rate="${animation.frameRate}"`,
    `data-animation-loop="${animation.loop ? "true" : "false"}"`,
  ].join(" ");
}

function renderLayoutVars(): string {
  return [
    `--canvas-width: ${PHONE_LAYOUT.canvas.width}`,
    `--canvas-height: ${PHONE_LAYOUT.canvas.height}`,
    `--board-design-size: ${PHONE_LAYOUT.board.designSize}px`,
    `--touch-min: ${PHONE_LAYOUT.controls.minTouch}px`,
  ].join("; ");
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
