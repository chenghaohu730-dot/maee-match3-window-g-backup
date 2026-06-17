# 童话宇宙 MVP 正式美术资源接入规范

本文档用于童话宇宙第一批正式美术资源接入准备与验收。当前亿仔角色使用横向序列帧 sheet 接入，已通过的正式 PNG 可在 `fairySkin` 中标记为可用。

## 资源命名

- 文件名全部使用小写英文、数字和下划线。
- 文件扩展名固定为 `.png`。
- 资源 key 与文件名保持一致，去掉 `.png` 后即为 skin key。
- 童话宇宙资源统一放在 `public/assets/fairy/` 下，按类型分目录。
- 第一批资源不要临时改名；如需新增变体，在下一窗口单独扩展 manifest 和文档。

## 目录

```text
public/assets/common/
public/assets/fairy/backgrounds/
public/assets/fairy/board/
public/assets/fairy/pieces/
public/assets/fairy/yizai/
public/assets/fairy/yizai/pro/
public/assets/fairy/monsters/
public/assets/fairy/vfx/
public/assets/fairy/ui/
```

## 尺寸与透明背景要求

### 棋子

- 原图：256x256 PNG
- 背景：透明
- 主体：控制在 220px 内，四周保留安全边距
- 显示：由 CSS/代码缩放到棋盘格内
- 识别：颜色识别必须强，红、蓝、黄、绿、紫、橙之间要一眼区分

### 棋盘

- `ft_board_frame.png`：680x680 PNG
- `ft_board_bg.png`：640x640 PNG
- `ft_grid_cell.png`：80x80 或 128x128 PNG
- `ft_grid_cell_highlight.png`：80x80 或 128x128 PNG

### 战斗背景

- `ft_battle_stage_bg.png`：750x360 PNG
- `ft_gameplay_bg.png`：750x1334 PNG

### 亿仔

- 角色动画优先使用 `public/assets/fairy/yizai/pro/` 下的 AI 视频效果优先版多行 sprite sheet。
- 每帧固定 `512x512` PNG，透明背景，按配置中的 `columns` / `rows` 排布。
- `pro/yizai_hero_idle_sheet.png`：3072x1024，12 帧，6x2，12fps，循环
- `pro/yizai_hero_attack_sheet.png`：4096x1024，16 帧，8x2，20fps
- `pro/yizai_hero_skill_sheet.png`：4096x1536，24 帧，8x3，20fps
- `pro/yizai_hero_ultimate_sheet.png`：4096x2048，32 帧，8x4，24fps
- `pro/yizai_hero_hurt_sheet.png`：3072x1024，12 帧，6x2，20fps
- `public/assets/fairy/yizai/` 下旧横向 sheet 保留为 legacy fallback：idle 4 帧、attack 6 帧、skill 8 帧、ultimate 10 帧、hurt 4 帧。
- 背景：透明
- 必须保留亿仔白熊主体、黑粗眉、橙黄色口鼻区、黑色大鼻子
- 头部或头饰必须有正向、清晰、无遮挡的 `MAEE`
- 造型方向：童话勇者，但不能丢亿仔本体特征

### 怪物

- 原图：384x384 PNG
- 背景：透明
- 风格：卡通童话风，不恐怖
- 第一批只做史莱姆 4 个状态：idle、hit、attack、defeat

## 第一批资源清单

| 类型 | 文件名 | 放置目录 | 尺寸 | 透明背景 | 是否必须 | 对应 skin key | 当前 fallback 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pieces | `piece_red_flame.png` | `public/assets/fairy/pieces/` | 256x256 | 是 | MVP 正式美术必须 | `piece_red_flame` | `available=false`，使用棋子 fallback |
| pieces | `piece_blue_frost.png` | `public/assets/fairy/pieces/` | 256x256 | 是 | MVP 正式美术必须 | `piece_blue_frost` | `available=false`，使用棋子 fallback |
| pieces | `piece_yellow_star.png` | `public/assets/fairy/pieces/` | 256x256 | 是 | MVP 正式美术必须 | `piece_yellow_star` | `available=false`，使用棋子 fallback |
| pieces | `piece_green_nature.png` | `public/assets/fairy/pieces/` | 256x256 | 是 | MVP 正式美术必须 | `piece_green_nature` | `available=false`，使用棋子 fallback |
| pieces | `piece_purple_arcane.png` | `public/assets/fairy/pieces/` | 256x256 | 是 | MVP 正式美术必须 | `piece_purple_arcane` | `available=false`，使用棋子 fallback |
| pieces | `piece_orange_courage.png` | `public/assets/fairy/pieces/` | 256x256 | 是 | MVP 正式美术必须 | `piece_orange_courage` | `available=false`，使用棋子 fallback |
| board | `ft_board_frame.png` | `public/assets/fairy/board/` | 680x680 | 建议透明 | MVP 正式美术必须 | `ft_board_frame` | `available=false`，使用棋盘框 fallback |
| board | `ft_board_bg.png` | `public/assets/fairy/board/` | 640x640 | 可不透明 | MVP 正式美术必须 | `ft_board_bg` | `available=false`，使用棋盘底 fallback |
| board | `ft_grid_cell.png` | `public/assets/fairy/board/` | 80x80 或 128x128 | 是 | MVP 正式美术必须 | `ft_grid_cell` | `available=false`，使用棋格 fallback |
| board | `ft_grid_cell_highlight.png` | `public/assets/fairy/board/` | 80x80 或 128x128 | 是 | MVP 正式美术必须 | `ft_grid_cell_highlight` | `available=false`，使用高亮棋格 fallback |
| backgrounds | `ft_gameplay_bg.png` | `public/assets/fairy/backgrounds/` | 750x1334 | 可不透明 | MVP 正式美术必须 | `ft_gameplay_bg` | `available=false`，使用玩法背景 fallback |
| backgrounds | `ft_battle_stage_bg.png` | `public/assets/fairy/backgrounds/` | 750x360 | 可不透明 | MVP 正式美术必须 | `ft_battle_stage_bg` | `available=false`，使用战斗舞台 fallback |
| yizai | `yizai_hero_idle.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_idle` | `available=true`，待机静态兜底 |
| yizai | `yizai_hero_attack.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_attack` | `available=true`，攻击静态兜底 |
| yizai | `yizai_hero_skill.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_skill` | `available=true`，技能静态兜底 |
| yizai | `yizai_hero_ultimate.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_ultimate` | `available=true`，大招静态兜底 |
| yizai | `yizai_hero_hurt.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_hurt` | `available=true`，受击静态兜底 |
| yizai | `yizai_hero_idle_sheet.png` | `public/assets/fairy/yizai/pro/` | 3072x1024 | 是 | AI 视频 pro sheet | `yizai_hero_idle_sheet_pro` | `available=false` 时回退 legacy sheet；待机循环 12 帧 |
| yizai | `yizai_hero_attack_sheet.png` | `public/assets/fairy/yizai/pro/` | 4096x1024 | 是 | AI 视频 pro sheet | `yizai_hero_attack_sheet_pro` | `available=false` 时回退 legacy sheet；普通攻击 16 帧 |
| yizai | `yizai_hero_skill_sheet.png` | `public/assets/fairy/yizai/pro/` | 4096x1536 | 是 | AI 视频 pro sheet | `yizai_hero_skill_sheet_pro` | `available=false` 时回退 legacy sheet；4 消技能 24 帧 |
| yizai | `yizai_hero_ultimate_sheet.png` | `public/assets/fairy/yizai/pro/` | 4096x2048 | 是 | AI 视频 pro sheet | `yizai_hero_ultimate_sheet_pro` | `available=false` 时回退 legacy sheet；5 消大招 32 帧 |
| yizai | `yizai_hero_hurt_sheet.png` | `public/assets/fairy/yizai/pro/` | 3072x1024 | 是 | AI 视频 pro sheet | `yizai_hero_hurt_sheet_pro` | `available=false` 时回退 legacy sheet；受击 12 帧 |
| yizai | `yizai_hero_idle_sheet.png` | `public/assets/fairy/yizai/` | 2048x512 | 是 | legacy fallback | `yizai_hero_idle_sheet` | `available=true`，待机循环 4 帧 |
| yizai | `yizai_hero_attack_sheet.png` | `public/assets/fairy/yizai/` | 3072x512 | 是 | legacy fallback | `yizai_hero_attack_sheet` | `available=true`，普通攻击 6 帧 |
| yizai | `yizai_hero_skill_sheet.png` | `public/assets/fairy/yizai/` | 4096x512 | 是 | legacy fallback | `yizai_hero_skill_sheet` | `available=true`，4 消技能 8 帧 |
| yizai | `yizai_hero_ultimate_sheet.png` | `public/assets/fairy/yizai/` | 5120x512 | 是 | legacy fallback | `yizai_hero_ultimate_sheet` | `available=true`，5 消大招 10 帧 |
| yizai | `yizai_hero_hurt_sheet.png` | `public/assets/fairy/yizai/` | 2048x512 | 是 | legacy fallback | `yizai_hero_hurt_sheet` | `available=true`，受击 4 帧 |
| monsters | `monster_slime_idle.png` | `public/assets/fairy/monsters/` | 384x384 | 是 | MVP 正式美术必须 | `monster_slime_idle` | `available=false`，使用史莱姆 fallback |
| monsters | `monster_slime_hit.png` | `public/assets/fairy/monsters/` | 384x384 | 是 | MVP 正式美术必须 | `monster_slime_hit` | `available=false`，使用史莱姆受击 fallback |
| monsters | `monster_slime_attack.png` | `public/assets/fairy/monsters/` | 384x384 | 是 | MVP 正式美术必须 | `monster_slime_attack` | `available=false`，使用史莱姆攻击 fallback |
| monsters | `monster_slime_defeat.png` | `public/assets/fairy/monsters/` | 384x384 | 是 | MVP 正式美术必须 | `monster_slime_defeat` | `available=false`，使用史莱姆退场 fallback |

## 当前 fallback 状态

- `fairySkin.resources` 已为第一批资源保留路径和 fallback 信息。
- 已接入并通过目检的正式 PNG 可保持 `available=true`。
- 图片不存在时，页面使用 CSS fallback 和占位文案，不应崩溃。
- Window I 放入正式 PNG 后，再逐项把确认可用的资源标记为 `available=true`。

## 接入后验证

1. 将正式 PNG 放入对应目录，文件名必须与上表一致。
2. 检查亿仔资源：白熊主体、粗黑眉、橙黄色口鼻区、黑鼻、正向可见 `MAEE`。
3. 将已通过目检的资源在 `fairySkin` 对应 resource 上标记为可用；亿仔 pro 序列帧需确认帧数、512x512 单帧和多行网格配置一致。
4. 运行：

```sh
npm test
npm run typecheck
npm audit
```

5. 打开本地预览，进入童话宇宙玩法页，检查：
   - 页面没有崩溃或白屏。
   - 缺失图片仍显示 fallback。
   - 已标记可用的图片显示为正式 PNG。
   - 棋子颜色识别清楚，棋盘格内不溢出。
   - 亿仔 `MAEE` 没有被裁切、遮挡、镜像或倒置。
