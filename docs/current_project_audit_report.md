# 《亿仔消消战》当前项目实机审计报告

## 1. 审计方式

- 工作目录：`D:\01_Codex源码项目\三消游戏`。
- 依赖检查：本地已有 `node_modules`，按“已安装则跳过”处理，未重新执行安装。
- 启动方式：发现当前已有 Vite 预览进程，命令行为 `vite --host 127.0.0.1 --port 5173`，访问地址为 `http://127.0.0.1:5173/`。
- 浏览器实机检查：打开了开始页、宇宙选择页、锁定宇宙弹窗、普通玩法页，并在棋盘中实际触发了普通 3 消。
- Debug 入口：检查了 `http://127.0.0.1:5173/?debug=animation-calibration`。该入口只有亿仔动画校准按钮 `attack / idle / hurt / skill / ultimate`，不是战斗状态、结算页或无尽挑战快速入口。
- 代码检查：读取了入口、场景切换、玩法渲染、结算渲染、技能/VFX、粒子、角色动画、波次、资源 manifest、皮肤配置和测试用例。
- 无法经正常实机流程进入的状态：普通胜利结算、普通失败结算、无尽挑战玩法、无尽挑战结算。本项目当前没有直接状态跳转入口；无尽挑战按钮只在普通胜利结算中出现。报告中这些状态按“代码路径确认，未完成正常实机流转”标注。
- 验收命令：已运行 `npm test`、`npm run typecheck`、`npm audit`、`npm run video:validate`、`npm run audit:assets`，均通过。

## 2. 项目技术栈与入口结构

- 技术栈：Vite + TypeScript + 原生 DOM 渲染；测试使用 Node 内置 test runner；资源/序列帧工具使用 `tsx` 和 `sharp`。
- 页面入口：`index.html` 挂载 `<main id="app">`，入口脚本为 `src/main.ts`。
- 应用入口：`src/main.ts` 根据 URL 查询参数判断是否进入 `mountGameApp` 或 `mountAnimationCalibration`。
- 场景结构：`src/ui/app.ts` 内部状态切换 `start -> universe -> gameplay`；不是路由式页面。
- 核心玩法：三消核心在 `src/core/board.ts`，战斗在 `src/core/combat.ts`，技能在 `src/core/skills.ts`，玩法控制器在 `src/core/gameplayController.ts`。
- UI 渲染：`src/ui/gameplayView.ts` 负责开始页、宇宙页、玩法页、结算弹窗的 HTML 字符串。
- 表现层：`characterAnimator` 播放亿仔 pro sprite sheet；怪物当前是静态 PNG 状态切换；`PresentationDirector` 和 `combatTimeline` 负责战斗表现时序。
- 构建方式：`package.json` 只有 `dev`、测试、类型检查、资源工具和视频工具脚本；当前没有正式 `build` 脚本。
- 微信小游戏配置：未发现 `project.config.json`、`game.json`、分包配置、远程资源下载配置或小游戏适配入口。

## 3. 当前功能完成度

| 模块 | 当前状态 | 是否可玩 | 问题 | 优先级 |
| --- | --- | --- | --- | --- |
| 开始页到宇宙页流程 | 已完成基础流程 | 是 | UI 是 CSS fallback，没有正式首页美术 | P0 |
| 宇宙选择 | 半成品 | 是 | 童话/锁定卡片都是 CSS 占位，积分解锁只是文字和弹窗 | P0 |
| 普通闯关玩法 | 半成品 | 是 | 可三消、可造成伤害；战斗 UI 和底部按钮仍有大量 CSS/文字占位 | P0 |
| 普通 3 消 | 已完成基础闭环 | 是 | 实机观察到亿仔 attack、怪物 hit、伤害数字、HP 变化；清除/下落视觉不够正式 | P0 |
| 4 消技能 | 代码完成，实机未稳定触发 | 理论可玩 | 有技能规则、VFX 代码和测试，但本次未通过正常实机流程触发到稳定样本；VFX 资源目录为空 | P0 |
| 5 消大招 | 代码完成，实机未稳定触发 | 理论可玩 | 有 ultimate 规则、screen shake 和 pro sheet 配置；本次未通过正常实机流程触发到稳定样本 | P0 |
| 怪物攻击 | 代码完成，实机未进入攻击波次 | 理论可玩 | 第 1 波不攻击；未正常打到第 2 波以上，代码测试确认可扣血 | P1 |
| 怪物死亡/下一波 | 代码完成，实机未正常打到 | 理论可玩 | 没有快速入口；代码有 defeat、Wave Cleared、wave.start | P1 |
| 普通胜利结算 | 代码路径存在，实机未进入 | 理论可用 | 没有快速入口；代码渲染为通用白色弹窗，带“无尽挑战”按钮 | P0 |
| 普通失败结算 | 代码路径存在，实机未进入 | 理论可用 | 失败分数强制显示 0，弹窗仍像临时 UI | P1 |
| 无尽挑战 | 代码路径存在，入口受胜利门控 | 否，未实机进入 | 只能从普通胜利结算进入；无直接入口/调试入口 | P0 |
| 微信小游戏适配 | 缺失 | 否 | 无小游戏配置、无分包、无远程资源、无缓存/版本策略 | P0 |
| 资源包体 | 有明显风险 | 不适合直接进主包 | `public/assets` 为 28.2 MB，单个大招 pro sheet 5.30 MB | P0 |

## 4. 当前 UI 实机观察

| 页面 | 当前真实观感 | 是否占位 | 缺什么 | 优先级 |
| --- | --- | --- | --- | --- |
| 开始页 | 有标题“亿仔消消战”、开始/排行/积分/兑换/设置按钮、最高分/积分；背景是深色渐变大厅 | 是，大部分是 CSS 占位 | 正式背景、正式 Logo、正式按钮图、亿仔 IP 首屏露出、hover/pressed/disabled 状态 | P0 |
| 开始页按钮 | 实机可点击，都是 `.primary-button` / `.secondary-button` 渐变样式；没有正式图片资源 | 是 | 按钮九宫格/图片、按下态、禁用态、音效/触感反馈 | P0 |
| 宇宙选择页 | 有返回、标题、积分 pill、三张横向卡片；轨道 `overflow-x:auto`、`scroll-snap-type:x mandatory` | 是 | 宇宙卡片正式插画、锁定图标、清晰兑换入口、正式卡片层级 | P0 |
| 童话宇宙卡片 | 金色渐变卡片，文字“已解锁 童话宇宙 6 波战斗关卡” | 是 | 正式童话宇宙美术和状态徽章 | P0 |
| 锁定宇宙卡片 | 灰色渐变卡片，文字“锁 未解锁”；点击弹出“需要积分兑换” | 是 | 锁定宇宙美术、积分兑换按钮/价格/反馈 | P0 |
| 普通玩法页 | 玩法背景、战斗舞台、棋盘框、棋盘底、棋子、亿仔 pro sheet、怪物 PNG 已显示 | 部分占位 | HUD、血条、底部按钮、暂停按钮、战斗信息面板仍是 CSS/文字 UI | P0 |
| 战斗区 | 童话战斗背景是真图；亿仔在左、怪物在右；怪物是正面图，不明确朝向亿仔 | 半成品 | 站位精修、角色朝向统一、角色落点/比例、正式 UI 面板 | P0 |
| 棋盘区 | 棋盘框、底、格子、棋子都是真图；64 个棋子完整 | 半成品 | 消除爆点、下落质感、选中态正式化 | P0 |
| 血条/分数/波次/combo | 波次、分数、HP、护盾、攻击条都有文字；血条资源 `fairy/ui` 为空，使用 CSS fallback | 是 | 正式血条、数字字体、波次牌、combo 美术 | P0 |
| 技能提示 | 代码会生成 `.skill-vfx-layer`、`.skill-pop`、`.combo-pop`，但本次未实机稳定触发 4/5 消 | 占位效果 | 技能图标/贴图、镜头节奏、屏幕震动可视化调优 | P0 |
| 底部按钮 | “返回宇宙”是普通 CSS 按钮；底部状态是纯文本 | 是 | 正式底栏、按钮状态、战斗提示文案样式 | P1 |
| 结算弹窗 | 代码渲染通用 result-panel/result-card，白底圆角卡片 | 是 | 胜利/失败/无尽专属结算视觉、奖励/积分/伤害汇总、正式按钮 | P0 |

## 5. 当前特效实机观察

| 特效项 | 当前真实表现 | 是否占位 | 缺什么 | 优先级 |
| --- | --- | --- | --- | --- |
| 普通 3 消 | 实机触发成功：亿仔从 `idle` 切到 `attack`，怪物切到 `hit`，出现 `-6` 伤害数字，怪物 HP 从 60/60 到 54/60 | 半成品 | 消除爆点和下落爽感仍弱；本次采样未抓到清除/下落明显视觉 | P0 |
| 棋子消除 | 代码有 `.piece.clearing` 缩小、淡出、发光；实机采样未稳定观察到完整清除阶段 | 半成品 | 正式消除贴图、粒子、音效、节奏 | P0 |
| 棋子下落 | 代码有 dropping/spawning transition；实机最终棋盘保持 64 个棋子 | 半成品 | 更明显的重力、弹性、生成光 | P1 |
| 亿仔 attack | 实机观察到 `yizai_hero_attack_sheet_pro` 被使用 | 已完成基础 | 攻击命中节奏和特效仍偏轻 | P0 |
| 怪物 hit | 实机观察到怪物 asset 切换到 `monster_slime_hit` | 已完成基础 | 静态图切换，不是序列帧动画 | P1 |
| 伤害数字 | 实机出现 `damage-float enemy-damage -6` | 半成品 | 字体、暴击/技能数字分级、飘字路径 | P1 |
| 4 消技能 | 本次未在正常实机流程稳定触发；代码有 skill timeline、技能文字、颜色粒子和 board effect | 占位/未实机验证 | 真实 4 消调试入口、正式粒子贴图、技能演出 | P0 |
| 5 消大招 | 本次未在正常实机流程稳定触发；代码有 ultimate timeline、large screen shake、ultimate pro sheet | 占位/未实机验证 | 大招全屏光效、镜头震动调优、强伤害数字 | P0 |
| combo | 本次未实机观察到 `2 COMBO / 3 COMBO / AMAZING`；代码有 `.combo-pop` 和 `.skill-vfx-combo` | 占位/未实机验证 | 连锁调试入口、正式 combo 字卡 | P1 |
| 怪物攻击 | 第 1 波史莱姆 attackInterval=0，不攻击；本次未正常打到后续波 | 未实机验证 | 第 2 波以上实机验证、玩家扣血反馈、敌方攻击特效 | P1 |
| 亿仔 hurt | 本次未实机触发；代码配置 `yizai_hero_hurt_sheet_pro` | 未实机验证 | 受击闪白/击退/屏幕反馈 | P1 |
| 怪物死亡 | 本次未正常实机触发；代码有 `enemy-state-defeat` 和 `monster_*_defeat.png` | 未实机验证 | 缩小/淡出/掉落光点、下一波过渡 | P1 |
| 无尽魔王 | 未经正常实机流程进入；代码渲染支持魔王、HP ∞、累计伤害、不会死亡、玩家死亡后失败结算 | 未实机验证 | 无尽入口、专属结算、魔王预加载 | P0 |
| 观察到的异常 | 自动化触发一次双组 3 消后，出现过 HP/伤害变化但底部文案停留在“已选择 3,7”的表现收尾不一致 | 有 bug 风险 | 需要单独复现：多组消除 + PresentationDirector 收尾 + selected/message 同步 | P0 |

## 6. 当前资源体积统计

| 目录 | 体积 | 说明 | 是否首包必需 | 建议处理 |
| --- | ---: | --- | --- | --- |
| `public/assets` | 28.2 MB | 全部运行资源 | 否 | 必须拆分，不能整体进主包 |
| `public/assets/common` | 71 B | 只有 `.gitkeep`，首页/common UI 正式资源缺失 | 是，但当前没有正式资源 | 后续正式 common UI 压缩后放主包 |
| `public/assets/universe` | 0 B | 宇宙卡片/锁图标缺失 | 否 | 放分包或远程，首页仅保留低清占位 |
| `public/assets/fairy/yizai` | 19.3 MB | 亿仔静态图、legacy sheet、pro sheet | 否 | pro sheet 远程/CDN，少量低清兜底可分包 |
| `public/assets/fairy/yizai/pro` | 11.7 MB | AI 视频 pro sprite sheet | 否 | 远程加载，按动作懒加载 |
| `public/assets/fairy/monsters` | 6.16 MB | 怪物多状态静态 PNG | 否 | 童话分包 + 按波次预加载；魔王放无尽分包/远程 |
| `public/assets/fairy/pieces` | 352.6 KB | 6 个棋子 PNG | 否 | 童话分包；进入童话前预加载 |
| `public/assets/fairy/board` | 861.0 KB | 棋盘框、底、格子、高亮 | 否 | 童话分包；可压缩 |
| `public/assets/fairy/backgrounds` | 1.55 MB | 玩法背景和战斗背景 | 否 | 童话分包或远程；首进童话前加载 |
| `public/assets/fairy/ui` | 43 B | 只有 `.gitkeep`，血条/攻击点正式 UI 缺失 | 是，待正式化 | 小尺寸 UI 可进童话分包或主包 common |
| `public/assets/fairy/vfx` | 44 B | 只有 `.gitkeep`，特效贴图缺失 | 否 | 后续按技能颜色远程/懒加载 |

## 7. 最大文件 Top 20

| 文件 | 大小 | 用途判断 | 是否适合主包 | 是否适合分包 | 是否适合远程 CDN | 是否建议压缩 |
| --- | ---: | --- | --- | --- | --- | --- |
| `public/assets/fairy/yizai/pro/yizai_hero_ultimate_sheet.png` | 5.30 MB | 亿仔大招 pro sprite sheet | 否，单文件已超 4MB | 不建议普通分包常驻 | 是，按大招首次触发前加载 | 是，必须 |
| `public/assets/fairy/yizai/pro/yizai_hero_skill_sheet.png` | 2.65 MB | 亿仔技能 pro sprite sheet | 否 | 可做童话动作分包 | 是 | 是 |
| `public/assets/fairy/yizai/yizai_hero_ultimate_sheet.png` | 1.87 MB | legacy 大招 fallback | 否 | 可选兜底分包 | 是 | 是 |
| `public/assets/fairy/yizai/yizai_hero_skill_sheet.png` | 1.61 MB | legacy 技能 fallback | 否 | 可选兜底分包 | 是 | 是 |
| `public/assets/fairy/yizai/pro/yizai_hero_attack_sheet.png` | 1.51 MB | 亿仔攻击 pro sprite sheet | 否 | 可放童话首战分包 | 是 | 是 |
| `public/assets/fairy/yizai/yizai_hero_attack_sheet.png` | 1.22 MB | legacy 攻击 fallback | 否 | 可选兜底分包 | 是 | 是 |
| `public/assets/fairy/backgrounds/ft_gameplay_bg.png` | 1.14 MB | 童话玩法背景 | 否 | 是，童话分包 | 可选 | 是 |
| `public/assets/fairy/yizai/pro/yizai_hero_hurt_sheet.png` | 1.12 MB | 亿仔受击 pro sprite sheet | 否 | 可按战斗预加载 | 是 | 是 |
| `public/assets/fairy/yizai/pro/yizai_hero_idle_sheet.png` | 1.11 MB | 亿仔待机 pro sprite sheet | 否 | 是，童话首战分包 | 可选 | 是 |
| `public/assets/fairy/yizai/yizai_hero_hurt_sheet.png` | 958.3 KB | legacy 受击 fallback | 否 | 可选兜底分包 | 是 | 是 |
| `public/assets/fairy/yizai/yizai_hero_idle_sheet.png` | 926.4 KB | legacy 待机 fallback | 否 | 可选兜底分包 | 可选 | 是 |
| `public/assets/fairy/board/ft_board_bg.png` | 478.2 KB | 棋盘底图 | 否 | 是，童话分包 | 不优先 | 是 |
| `public/assets/fairy/backgrounds/ft_battle_stage_bg.png` | 416.0 KB | 战斗舞台背景 | 否 | 是，童话分包 | 可选 | 是 |
| `public/assets/fairy/monsters/boss_dragon_attack.png` | 355.1 KB | 第 6 波龙王攻击图 | 否 | 是，按波次加载 | 可选 | 是 |
| `public/assets/fairy/monsters/boss_dragon_idle.png` | 353.6 KB | 第 6 波龙王待机图 | 否 | 是，按波次加载 | 可选 | 是 |
| `public/assets/fairy/monsters/boss_dragon_hit.png` | 351.9 KB | 第 6 波龙王受击图 | 否 | 是，按波次加载 | 可选 | 是 |
| `public/assets/fairy/board/ft_board_frame.png` | 341.3 KB | 棋盘外框 | 否 | 是，童话分包 | 不优先 | 是 |
| `public/assets/fairy/monsters/monster_tree_attack.png` | 309.0 KB | 第 4 波树精攻击图 | 否 | 是，按波次加载 | 可选 | 是 |
| `public/assets/fairy/monsters/boss_dragon_defeat.png` | 278.0 KB | 第 6 波龙王死亡图 | 否 | 是，按波次加载 | 可选 | 是 |
| `public/assets/fairy/monsters/boss_demon_king_attack.png` | 263.8 KB | 无尽魔王攻击图 | 否 | 适合无尽分包 | 是 | 是 |

## 8. 微信小游戏包体风险判断

当前如果把 `public/assets` 直接进入小游戏主包，风险是确定的：总体 28.2 MB，远超微信小游戏常见主包 4 MB 限制。更严重的是，`yizai_hero_ultimate_sheet.png` 单个 pro 文件 5.30 MB，单文件就已经超过 4 MB。

不应该放主包的资源：

- 所有亿仔 pro/legacy sprite sheet。
- 所有怪物多状态 PNG，尤其后续波次和无尽魔王。
- 童话玩法大背景、战斗背景、棋盘大图。
- 后续 VFX 贴图、未来多宇宙资源。

适合远程加载的资源：

- 亿仔视频 sprite sheet，尤其 skill/ultimate/hurt。
- 高帧率或高尺寸角色动作资源。
- 无尽魔王、龙王、后期怪物资源。
- 大招/VFX 贴图和未来多宇宙素材。

适合分包的资源：

- 童话宇宙基础包：棋子、棋盘、玩法背景、战斗背景、第一波怪物、必要 HP/UI 小图。
- 无尽挑战分包：魔王 idle/hit/attack/defeat、无尽专属 UI、无尽结算资源。
- 后续每个宇宙一个独立资源分包。

必须首屏加载的资源：

- 应用代码最小入口。
- 开始页必要 UI、Logo、基础按钮。
- 占位/低清 fallback。
- 资源 manifest、版本号、加载失败提示。

## 9. 推荐资源加载架构

主包：

- 保留核心代码入口、场景框架、基础 CSS、资源 manifest、加载器、缓存版本配置。
- 放开始页最小正式 UI：Logo、小按钮、通用弹窗底板、低清占位图。
- 不放任何 pro sprite sheet，不放完整童话怪物资源，不放大背景。

分包：

- `fairy-base`：童话棋子、棋盘、背景、第一波史莱姆四状态、低清亿仔 idle/attack/hurt 或压缩版 sheet。
- `fairy-waves`：南瓜、乌鸦、树精、狼、龙王按波次资源，可进入对应波次前预加载。
- `endless`：魔王资源、无尽 UI、无尽结算资源。
- 未来多宇宙：每个宇宙独立资源分包，不与童话宇宙混包。

远程资源：

- 亿仔 pro 动作 sheet：按动作分文件，idle/attack 可进入童话前预加载，skill/ultimate/hurt 可按首次使用或战斗前预取。
- 大招、技能、粒子 atlas。
- 高分辨率背景和活动资源。
- 后期 Boss、无尽 Boss、未来宇宙素材。

预加载：

- 首屏：只预加载 common UI 和资源版本文件。
- 进入童话宇宙前：预加载棋子、棋盘、玩法背景、战斗背景、亿仔 idle/attack 兜底、第一波怪物 idle/hit/attack/defeat。
- 进入无尽挑战前：预加载魔王 idle/hit/attack、无尽 HP/累计伤害 UI、大招/受击必要动作。
- 进入下一波前：提前加载下一波怪物四状态图。

懒加载：

- skill/ultimate sheet 首次需要前加载，加载成功后缓存。
- VFX 贴图按技能颜色/等级加载。
- victory/lost/endless result 专属素材在战斗接近结束或结算前加载。

fallback：

- 远程资源失败时先降级到本地低清静态 PNG。
- 本地低清也失败时使用现有 CSS fallback，并显示轻量重试按钮。
- 角色动作失败时允许 `pro sheet -> legacy sheet -> static PNG -> CSS placeholder`。
- 怪物资源失败时允许 `当前怪物状态图 -> idle 图 -> slime fallback -> CSS placeholder`。

缓存与版本号：

- 资源 URL 统一加内容 hash 或资源版本号。
- 远程资源用 manifest 管理 `version / size / hash / fallback`。
- 本地缓存需要记录资源版本，版本不匹配时清理旧缓存。
- 大文件分批下载，下载失败可重试，不阻塞主流程进入占位战斗。

## 10. UI 下一步优化建议

P0 必须马上做：

- 正式化开始页：背景、Logo、亿仔 IP 首屏露出、开始按钮、排行/积分/兑换/设置按钮。
- 正式化宇宙选择：童话卡片、锁定卡片、锁图标、积分价格/兑换入口。
- 正式化结算弹窗：普通胜利、普通失败、无尽失败分开设计，不再共用临时白卡。
- 补齐 `public/assets/common`、`public/assets/universe`、`public/assets/fairy/ui` 的正式资源。
- 为按钮补齐 hover/pressed/disabled，当前主要只有普通 CSS 基础态。

P1 应该做：

- 调整玩法 HUD、血条、攻击条、底部状态栏的正式样式。
- 优化亿仔和怪物站位、比例和朝向；当前怪物多为正面图，不明确面向亿仔。
- 补充暂停弹窗、设置弹窗、积分弹窗的正式状态。
- 在无尽挑战入口前增加明确预加载 UI。

P2 后面做：

- 多宇宙视觉体系。
- 排行榜/积分/兑换的完整运营 UI。
- 响应式适配和低端机降级皮肤。

## 11. 特效下一步优化建议

P0 必须马上做：

- 增加开发态战斗状态入口，用于一键验证普通胜利、普通失败、无尽、4 消、5 消、怪物攻击、怪物死亡。
- 复测并修复自动化中观察到的多组消除后表现收尾不一致风险。
- 正式化 4 消和 5 消的可视演出：不只依赖文字和 CSS 光效。
- 明确普通 3 消的棋子消除/下落视觉节奏。

P1 应该做：

- 给 4 消技能补颜色粒子、棋盘清除路径、战斗区命中特效。
- 给 5 消大招补强屏幕震动、全屏光、强伤害数字、停顿/爆发节奏。
- 给怪物攻击补攻击轨迹、亿仔 hurt 反馈、玩家血条扣血动画。
- 给怪物死亡补缩小、淡出、光点、下一波提示。

P2 后面做：

- 按技能颜色做 VFX atlas。
- 按怪物类型做专属受击/死亡特效。
- 音效、震动、低端设备特效等级配置。

## 12. 后续开发窗口建议

| 窗口 | 目标 | 范围 | 不要改什么 | 交付物 |
| --- | --- | --- | --- | --- |
| U1：微信资源加载架构改造 | 解决主包 4MB 风险 | 资源 manifest、分包/远程加载、fallback、缓存版本 | 不改三消/战斗数值，不重做 UI | 加载架构、资源分层、失败降级、包体统计 |
| U2：UI 正式化总装 | 把开始/宇宙/玩法/结算从 CSS 占位变成正式 UI | common、universe、fairy/ui、result UI | 不改 core，不改技能逻辑，不改资源加载策略 | 正式页面 UI、按钮状态、结算模板 |
| U3：战斗特效正式化 | 让 3/4/5 消、combo、怪物攻击/死亡有爽感 | `skillVfxLayer`、`particleLayer`、CSS/VFX 资源接入 | 不改伤害、分数、棋盘规则 | 特效资源接入、实机触发验证、调试入口 |
| U4：结算与积分完善 | 补齐普通胜利/失败/无尽结算和积分奖励 | result panel、积分展示、无尽累计伤害、再来/返回/挑战按钮 | 不改战斗规则，不做微信包体改造 | 三套结算 UI、积分结算说明、状态测试 |
| U5：微信小游戏适配与真机测试 | 从 Web 预览走向微信可跑 | 小游戏配置、构建脚本、主包/分包验收、真机性能 | 不新增玩法，不重写 UI/特效 | 微信工程、真机测试报告、包体/加载日志 |

