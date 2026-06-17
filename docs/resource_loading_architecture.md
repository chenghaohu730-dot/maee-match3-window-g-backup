# 《亿仔消消战》资源加载架构方案

## 1. 当前资源层级

当前资源已在 `src/assets/resourceManifest.ts` 统一登记为 6 层：

| Layer | 当前体积 | 用途 | 当前建议 |
| --- | ---: | --- | --- |
| common | 0 B | 首屏、Logo、按钮、通用弹窗、宇宙卡片、低清占位 | keep-local |
| fairy-base | 11.0 MB | 棋子、棋盘、童话背景、第一波史莱姆、亿仔静态和 legacy fallback、基础 UI | subpackage + compress |
| fairy-waves | 4.57 MB | 第 2-6 波怪物状态图 | subpackage |
| yizai-pro | 11.7 MB | 亿仔 pro 视频动作 sprite sheet | remote |
| endless | 989.6 KB | 无尽挑战魔王资源 | remote 或 endless 分包 |
| vfx | 0 B | 后续正式 VFX atlas 和字卡 | lazy-load |

`public/assets` 总体积仍为 28.2 MB，不适合整体进入微信小游戏主包。

## 2. 主包建议

主包只保留运行入口、场景框架、基础 CSS、资源 manifest、资源 loader、版本号、错误降级提示和必要 common UI。当前 common 正式图片仍缺失，所以主包暂时主要依赖 CSS fallback。

不进入主包：亿仔 pro/legacy 大 sheet、怪物全量状态图、童话大背景、棋盘大图、魔王、未来 VFX atlas。

## 3. 分包建议

`fairy-base` 是童话首战分包候选，但当前 11.0 MB 超过 4 MB 预算，需要继续拆出 legacy sheet 或压缩背景/棋盘。

`fairy-waves` 按 waveId 预留：`pumpkin_imp`、`fairy_crow`、`tree_spirit`、`forest_wolf`、`fairy_dragon_boss`。进入下一波前调用 `preloadForWave(waveId)`。

`endless` 可独立为无尽挑战分包；魔王也已标记 remote，后续可按发行策略二选一。

## 4. 远程资源建议

`yizai-pro` 默认 remote，包含：

- `yizai_hero_idle_sheet_pro`
- `yizai_hero_attack_sheet_pro`
- `yizai_hero_skill_sheet_pro`
- `yizai_hero_ultimate_sheet_pro`
- `yizai_hero_hurt_sheet_pro`

`endless` 魔王四状态也标记 remote。当前 Web 版仍返回本地 URL，不实际下载 CDN；`remoteUrl` 已作为后续配置预留。

## 5. 预加载策略

- `preloadForStartup()`：首屏 common 和 `requiredForStart`。
- `preloadForFairy()`：common + fairy-base。
- `preloadForWave(waveId)`：指定后续波次的怪物四状态。
- `preloadForEndless()`：无尽挑战魔王资源。

所有预加载都是非阻塞设计，失败只 warning，不阻止玩法继续。

## 6. 懒加载策略

亿仔 legacy sheet、亿仔 pro sheet、怪物未来 sheet、VFX atlas 都是 `on-demand` 或 `lazy-load`。4 消/5 消/受击/大招等高体积动作不应在首屏强制加载。

## 7. fallback 规则

- 亿仔动作：pro sheet -> legacy sheet -> static PNG -> CSS placeholder。
- 怪物：当前状态图 -> 本怪物 idle -> 史莱姆/龙王兜底 -> CSS placeholder。
- UI：正式 UI 图 -> CSS fallback。
- VFX：正式贴图 -> CSS 粒子 / CSS 光效。

`src/assets/resourceLoader.ts` 对加载失败统一 warning 并返回 fallback URL 或空字符串，不向上抛出导致游戏崩溃。

## 8. 当前资源体积预算

预算检查由 `npm run audit:assets` 输出，不阻塞测试。

当前超预算重点：

- `fairy-base`：11.0 MB，超过 4 MB。
- `ft_gameplay_bg`：1.14 MB，超过单资源 1 MB 建议。
- 亿仔 legacy sheet：926 KB 到 1.87 MB，需要压缩或移出 fairy-base。
- `yizai-pro`：11.7 MB，必须 remote/on-demand。
- 龙王 idle/hit/attack 超过当前单图建议，建议压缩。

## 9. 后续 UI 资源接入规则

新增 UI 资源先进入 `resourceManifest.ts`，必须写明 `layer`、`type`、`preloadPolicy`、`sizeBudgetKB`、`fallbackId` 或 CSS fallback。渲染层继续通过皮肤资源和 `getResourceUrl(id)` 获取 URL，不直接在组件里硬编码新路径。

正式 UI 缺图时保持 `.uses-fallback` CSS 状态，不阻塞开始页、宇宙页或玩法页。

## 10. 后续 VFX 资源接入规则

VFX atlas 默认 `vfx` layer + `on-demand` + `lazy-load`。只有低体积、复用率高的通用小资源才考虑进入分包。技能表现仍先走现有 CSS/DOM fallback，等 U3 正式贴图到位后再按技能颜色或技能等级登记 manifest。
