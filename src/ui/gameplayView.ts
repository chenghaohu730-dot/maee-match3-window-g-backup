import type { MatchCell, Piece } from "../core/board.ts";
import type { GameplayEvent, GameplayState } from "../core/gameplayTypes.ts";
import {
  getSkinResource,
  hasImageResource,
  type Match3Skin,
  type SkinAnimation,
} from "../skins/skinTypes.ts";
import type { AssetKey } from "../assets/assetManifest.ts";
import type { PlayerProgress } from "./progressionStore.ts";
import type { ModalKind } from "./sceneState.ts";
import { UNIVERSE_CARDS } from "./sceneState.ts";
import { PHONE_LAYOUT } from "./layout.ts";
import {
  getBattleVfxPresentation,
  getScreenShakeClassFromKeys,
  getSkillDisplayText,
} from "./skillVfxLayer.ts";
import {
  getCharacterAnimationConfig,
  getCharacterAnchors,
  getSpriteAnimationDurationMs,
} from "./characterAnimationConfig.ts";
import { resolveCharacterAnimationSource } from "./characterAnimator.ts";
import type {
  CharacterAnchorConfig,
  CharacterAnimationSnapshot,
  CharacterId,
  EnemyAnimationState,
  SpriteAnimationConfig,
  YizaiAnimationState,
} from "./characterAnimationTypes.ts";
import { createCharacterAnimationSnapshot } from "./characterStateMachine.ts";

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
  characterAnimations?: CharacterAnimationSnapshot;
  showTurnFeedback?: boolean;
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
  const showTurnFeedback = model.showTurnFeedback ?? true;
  const statusMessage = model.message || formatEventSummary(model.lastEvents);

  return renderPhoneFrame(
    skin,
    `
      <div class="scene gameplay-scene ${skin.sceneClasses.gameplay} ${assetClasses(
        skin,
        "ft_gameplay_bg",
      )}" ${assetAttrs(skin, "ft_gameplay_bg")}>
        <header class="game-hud">
          <strong>${formatWaveLabel(state)}</strong>
          <span>Score ${state.score}</span>
          <button class="icon-button" type="button" aria-label="暂停">Ⅱ</button>
        </header>

        ${renderBattleStage(model)}

        <section class="board-zone">
          <div class="board-stage ${
            showTurnFeedback ? getShakeClass(state) : ""
          } ${assetClasses(
            skin,
            "ft_board_frame",
          )}" ${assetAttrs(skin, "ft_board_frame")}>
            <div class="board ${assetClasses(
              skin,
              "ft_board_bg",
            )}" aria-label="8 by 8 match board" ${assetAttrs(skin, "ft_board_bg")}>
              ${renderBoardCells(model.pieces, model.selected, skin)}
            </div>
            ${renderBoardFeedback(
              state,
              model.lastEvents,
              showTurnFeedback,
            )}
            ${showTurnFeedback ? renderVfxFallbacks(state, skin) : ""}
          </div>
        </section>

        <footer class="bottom-status">
          <div class="turn-message">${escapeHtml(statusMessage)}</div>
          <div class="bottom-score">最高分 ${model.progress.highestScore}</div>
          <button class="secondary-button compact" type="button" data-action="return-universe">返回宇宙</button>
        </footer>
      </div>

      ${renderResultPanel(state, skin)}
    `,
  );
}

export function renderBoardCells(
  pieces: readonly (Piece | null)[],
  selected: MatchCell | null,
  skin: Match3Skin,
): string {
  return pieces
    .map((piece, index) => renderBoardCell(piece, index, selected, skin))
    .join("");
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

function renderBattleStage(model: GameplayViewModel): string {
  const { state, skin } = model;
  const showTurnFeedback = model.showTurnFeedback ?? true;
  const feedbackEvents = showTurnFeedback ? model.lastEvents : [];
  const characterAnimations =
    model.characterAnimations ??
    createCharacterAnimationSnapshot(state, []);
  const playerState = characterAnimations.yizai;
  const enemyState = characterAnimations.enemy;

  return `
    <section class="battle-stage battle-zone ${
      showTurnFeedback ? getShakeClass(state) : ""
    }" aria-label="battle stage">
      <div class="battle-bg ${assetClasses(
        skin,
        "ft_battle_stage_bg",
      )}" ${assetAttrs(skin, "ft_battle_stage_bg")}></div>
      <div class="battle-character-layer">
        <div class="player-slot ${playerStateClass(playerState)}">
          ${renderYizaiCharacter(skin, playerState)}
        </div>
        <div class="stage-vfx-lane">
          <div class="versus-mark">VS</div>
          <div class="stage-hit-flash ${
            showTurnFeedback ? getShakeClass(state) : ""
          }"></div>
        </div>
        <div class="enemy-slot ${enemyStateClass(enemyState)}">
          ${renderEnemyCharacter(skin, state, enemyState)}
        </div>
      </div>
      <div class="battle-vfx-layer" aria-hidden="true">
        ${showTurnFeedback ? renderBattleVfxFallback(state) : ""}
      </div>
      <div class="battle-hud-layer combat-info-panel" aria-label="combat info">
        ${renderBattleHpPanel(
          skin,
          "玩家 HP",
          state.playerHp,
          state.playerMaxHp,
          "player",
        )}
        ${renderShieldPanel(skin, state.playerShield, state.playerMaxHp)}
        ${renderBattleHpPanel(
          skin,
          state.enemyName || getEnemyDisplayName(state.enemyId),
          state.enemyHp,
          state.enemyMaxHp,
          "enemy",
        )}
        ${renderAttackPips(
          skin,
          state.enemyAttackCounter,
          state.enemyAttackInterval,
        )}
      </div>
      ${
        showTurnFeedback
          ? renderDamageFloatLayer(state, feedbackEvents)
          : `<div class="damage-float-layer"></div>`
      }
    </section>
  `;
}

function renderBattleHpPanel(
  skin: Match3Skin,
  label: string,
  current: number,
  max: number,
  variant: "player" | "enemy",
): string {
  const percent = getPercent(current, max);
  const fillKey: AssetKey =
    variant === "player" ? "ui_hp_bar_player_fill" : "ui_hp_bar_enemy_fill";
  const panelClass = variant === "player" ? "player-hp-panel" : "enemy-hp-panel";

  return `
    <div class="${panelClass} hp-block">
      <div class="hp-label">
        <span>${escapeHtml(label)}</span>
        <span>${formatNumber(current)}/${formatNumber(max)}</span>
      </div>
      <div class="hp-track ${assetClasses(skin, "ui_hp_bar_bg")}" ${assetAttrs(
        skin,
        "ui_hp_bar_bg",
      )}>
        <div
          class="hp-fill ${variant} ${assetClasses(skin, fillKey)}"
          style="width: ${percent}%"
          ${assetAttrs(skin, fillKey)}
        ></div>
      </div>
    </div>
  `;
}

function renderShieldPanel(
  skin: Match3Skin,
  shield: number,
  playerMaxHp: number,
): string {
  const percent = getPercent(shield, playerMaxHp);
  const activeClass = shield > 0 ? "shield-active" : "shield-empty";

  return `
    <div class="player-shield-panel hp-block ${activeClass}">
      <div class="hp-label">
        <span>护盾</span>
        <span>${formatNumber(shield)}</span>
      </div>
      <div class="hp-track shield-track ${assetClasses(
        skin,
        "ui_hp_bar_bg",
      )}" ${assetAttrs(skin, "ui_hp_bar_bg")}>
        <div
          class="hp-fill shield ${assetClasses(skin, "ui_shield_bar_fill")}"
          style="width: ${percent}%"
          ${assetAttrs(skin, "ui_shield_bar_fill")}
        ></div>
      </div>
    </div>
  `;
}

function renderAttackPips(
  skin: Match3Skin,
  current: number,
  max: number,
): string {
  if (max <= 0) {
    return `
      <div class="enemy-attack-pips inactive">
        <span>攻击条</span>
        <strong>不攻击</strong>
      </div>
    `;
  }

  const safeMax = Math.max(1, Math.floor(max));
  const safeCurrent = Math.max(0, Math.min(safeMax, Math.floor(current)));

  return `
    <div class="enemy-attack-pips" aria-label="enemy attack pips">
      <div class="attack-pip-label">
        <span>攻击条</span>
        <strong>${safeCurrent}/${safeMax}</strong>
      </div>
      <div class="attack-pip-row">
        ${Array.from({ length: safeMax }, (_, index) =>
          renderAttackPip(skin, index < safeCurrent),
        ).join("")}
      </div>
    </div>
  `;
}

function renderAttackPip(skin: Match3Skin, active: boolean): string {
  const key: AssetKey = active ? "ui_attack_pip_on" : "ui_attack_pip_off";

  return `
    <span
      class="attack-pip ${active ? "on" : "off"} ${assetClasses(skin, key)}"
      ${assetAttrs(skin, key)}
    ></span>
  `;
}

function renderYizaiCharacter(
  skin: Match3Skin,
  animationState: YizaiAnimationState,
): string {
  const config = getCharacterAnimationConfig("yizai", animationState);
  const key = getRenderAssetKey(config, skin);
  const animation = skin.animations.yizai[animationState];

  return `
    <div class="maee-placeholder character-sprite ${assetClasses(
      skin,
      key,
    )} ${animation.fallbackClass} ${characterFallbackClass(
      animationState,
    )}" aria-label="亿仔占位" ${assetAttrs(
      skin,
      key,
    )} ${characterAnimationAttrs(
      "yizai",
      animationState,
      config,
      animation.id,
      getCharacterAnchors("yizai"),
    )}>
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

function renderEnemyCharacter(
  skin: Match3Skin,
  state: GameplayState,
  animationState: EnemyAnimationState,
): string {
  const config = getCharacterAnimationConfig("enemy", animationState);
  const key = getEnemyRenderAssetKey(skin, state, animationState, config);
  const animation = skin.animations.monsters[state.enemyId];

  return `
    <div class="monster-placeholder character-sprite ${assetClasses(
      skin,
      key,
    )} ${animation?.fallbackClass ?? ""} ${characterFallbackClass(
      animationState,
    )}" ${assetAttrs(skin, key)} ${characterAnimationAttrs(
      "enemy",
      animationState,
      config,
      `enemy_${animationState}`,
      getCharacterAnchors("enemy"),
    )}>
      <span>怪物</span>
      <strong>${escapeHtml(state.enemyName || getEnemyDisplayName(state.enemyId))}</strong>
    </div>
  `;
}

function renderBattleVfxFallback(state: GameplayState): string {
  const key = getBattleVfxKey(state.lastVfxKeys);

  if (!key) {
    return "";
  }

  const presentation = getBattleVfxPresentation(key);

  return `
    <span class="battle-vfx-flash ${presentation.cssClass} battle-vfx-${presentation.tone}">
      ${escapeHtml(presentation.label)}
    </span>
  `;
}

function renderDamageFloatLayer(
  state: GameplayState,
  events: readonly GameplayEvent[],
): string {
  const enemyDamage =
    state.lastDamage > 0
      ? `<span class="damage-float enemy-damage">-${formatNumber(
          state.lastDamage,
        )}</span>`
      : "";
  const playerDamage = getLastCombatAmount(events, "playerDamaged");
  const playerDamageText =
    playerDamage > 0
      ? `<span class="damage-float player-damage">-${formatNumber(
          playerDamage,
        )}</span>`
      : "";

  if (!enemyDamage && !playerDamageText) {
    return `<div class="damage-float-layer"></div>`;
  }

  return `<div class="damage-float-layer">${enemyDamage}${playerDamageText}</div>`;
}

function getLastCombatAmount(
  events: readonly GameplayEvent[],
  type: "enemyDamaged" | "playerDamaged",
): number {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];

    if (event?.type !== "combat" || event.event.type !== type) {
      continue;
    }

    return event.event.amount;
  }

  return 0;
}

function formatWaveLabel(state: GameplayState): string {
  if (state.isEndlessWave) {
    return `Wave ${state.wave}/∞ 无尽挑战`;
  }

  return `Wave ${state.wave}/${state.totalWaves}`;
}

function renderBoardCell(
  piece: Piece | null,
  index: number,
  selected: MatchCell | null,
  skin: Match3Skin,
): string {
  const x = piece?.x ?? index % PHONE_LAYOUT.board.columns;
  const y = piece?.y ?? Math.floor(index / PHONE_LAYOUT.board.columns);
  const isSelected = selected?.x === x && selected.y === y;
  const cellAssetKey = isSelected ? "ft_grid_cell_highlight" : "ft_grid_cell";

  return `
    <div
      class="board-cell${isSelected ? " selected" : ""}${piece ? "" : " empty-cell"} ${assetClasses(
        skin,
        cellAssetKey,
      )}"
      data-cell-x="${x}"
      data-cell-y="${y}"
      ${assetAttrs(skin, cellAssetKey)}
    >
      ${piece ? renderPiece(piece, isSelected, skin) : ""}
    </div>
  `;
}

function renderPiece(
  piece: Piece,
  isSelected: boolean,
  skin: Match3Skin,
): string {
  const selectedClass = isSelected ? " selected" : "";
  const assetKey = skin.pieceAssets[piece.type];

  return `
    <button
      class="piece type-${piece.type}${selectedClass} ${assetClasses(
        skin,
        assetKey,
      )}"
      type="button"
      data-piece-id="${escapeAttribute(piece.id)}"
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
  const score = state.phase === "lost" ? 0 : state.score;

  return `
    <section class="result-panel" aria-label="result">
      <div class="result-card ${assetClasses(
        skin,
        "modal_common",
      )}" ${assetAttrs(skin, "modal_common")}>
        <h2>${title}</h2>
        <p>本局分数 ${score}</p>
        <button class="primary-button restart-button" type="button">再来一局</button>
        <button class="secondary-button compact" type="button" data-action="return-universe">返回宇宙</button>
      </div>
    </section>
  `;
}

function renderBoardFeedback(
  state: GameplayState,
  events: readonly GameplayEvent[],
  showTurnFeedback = true,
): string {
  if (!showTurnFeedback) {
    return `<div class="board-feedback"></div>`;
  }

  const skillText = getSkillDisplayText(
    state.lastVfxKeys,
    state.lastSkillText,
    state.lastSkillLevel,
  );
  const shuffle = events.some((event) => event.type === "boardShuffled")
    ? `<div class="shuffle-pop">棋盘重排</div>`
    : "";
  const skill = skillText
    ? `<div class="skill-pop ${state.lastSkillLevel ?? "skill"}">${escapeHtml(
        skillText,
      )}</div>`
    : "";
  const combo =
    state.lastComboCount > 1
      ? `<div class="combo-pop">${formatComboText(state.lastComboCount)}</div>`
      : "";

  return `<div class="board-feedback">${shuffle}${skill}${combo}</div>`;
}

function formatComboText(chainCount: number): string {
  if (chainCount >= 4) {
    return "AMAZING";
  }

  return `${chainCount} COMBO`;
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
  return getScreenShakeClassFromKeys(state.lastVfxKeys);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "∞";
  }

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

function getRenderAssetKey(
  config: SpriteAnimationConfig,
  skin: Match3Skin,
): AssetKey {
  return resolveCharacterAnimationSource(config, skin).key;
}

function getEnemyRenderAssetKey(
  skin: Match3Skin,
  state: GameplayState,
  animationState: EnemyAnimationState,
  config: SpriteAnimationConfig,
): AssetKey {
  if (state.enemyId === "forest-slime") {
    return getRenderAssetKey(config, skin);
  }

  if (animationState !== "idle") {
    return getRenderAssetKey(config, skin);
  }

  return skin.monsterAssets[state.enemyId] ?? "monster_slime_idle";
}

function getEnemyDisplayName(enemyId: string): string {
  const names: Record<string, string> = {
    "forest-slime": "森林史莱姆",
    "pumpkin-fiend": "南瓜怪",
    "crow-fiend": "乌鸦怪",
    "thorn-treant": "荆棘树精",
    "wolf-soldier": "狼兵",
    "young-black-dragon-king": "黑龙幼王",
    "endless-challenge": "无尽挑战",
  };

  return names[enemyId] ?? enemyId;
}

function playerStateClass(state: YizaiAnimationState): string {
  return `yizai-state-${state}`;
}

function enemyStateClass(state: EnemyAnimationState): string {
  return `enemy-state-${state}`;
}

function getBattleVfxKey(keys: readonly string[]): string | undefined {
  return keys.find(
    (key) =>
      !key.startsWith("screenShake:") &&
      !key.startsWith("skillText:") &&
      !key.startsWith("combo:"),
  );
}

function getPercent(current: number, max: number): number {
  if (!Number.isFinite(max)) {
    return current > 0 ? 100 : 0;
  }

  if (max <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (current / max) * 100));
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

function characterAnimationAttrs(
  characterId: CharacterId,
  state: string,
  config: SpriteAnimationConfig,
  animationId: string,
  anchors: CharacterAnchorConfig,
): string {
  const attrs = [
    `data-character-id="${characterId}"`,
    `data-animation-state="${escapeHtml(state)}"`,
    `data-animation-id="${escapeHtml(animationId)}"`,
    `data-frame-rate="${config.fps}"`,
    `data-animation-loop="${config.loop ? "true" : "false"}"`,
    `data-frame-width="${config.frameWidth}"`,
    `data-frame-height="${config.frameHeight}"`,
    `data-frame-count="${config.frameCount}"`,
    `data-animation-duration-ms="${getSpriteAnimationDurationMs(config)}"`,
    `data-sprite-key="${escapeHtml(config.key)}"`,
  ];

  if (config.fallbackKey) {
    attrs.push(`data-fallback-key="${escapeHtml(config.fallbackKey)}"`);
  }

  if (config.returnTo) {
    attrs.push(`data-return-to="${escapeHtml(config.returnTo)}"`);
  }

  for (const [name, point] of Object.entries(anchors)) {
    if (!point) {
      continue;
    }

    const key = toKebab(name);
    attrs.push(`data-anchor-${key}-x="${point.x}"`);
    attrs.push(`data-anchor-${key}-y="${point.y}"`);
  }

  return attrs.join(" ");
}

function characterFallbackClass(state: string): string {
  return `character-fallback-${state}`;
}

function renderLayoutVars(): string {
  return [
    `--canvas-width: ${PHONE_LAYOUT.canvas.width}`,
    `--canvas-height: ${PHONE_LAYOUT.canvas.height}`,
    `--board-design-size: ${PHONE_LAYOUT.board.designSize}px`,
    `--board-width-ratio: ${(
      (PHONE_LAYOUT.board.designSize / PHONE_LAYOUT.canvas.width) *
      100
    ).toFixed(3)}%`,
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

function toKebab(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
