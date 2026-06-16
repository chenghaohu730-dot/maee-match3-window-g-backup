# 童话宇宙 MVP 正式美术资源接入规范

本文档用于 Window H：童话宇宙第一批正式美术资源接入准备。当前阶段只建立目录、命名、尺寸和校验机制，不放入真实 PNG，不把资源标记为可用。

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

- 原图：512x512 PNG
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
| yizai | `yizai_hero_idle.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_idle` | `available=false`，使用亿仔待机 fallback |
| yizai | `yizai_hero_attack.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_attack` | `available=false`，使用亿仔攻击 fallback |
| yizai | `yizai_hero_skill.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_skill` | `available=false`，使用亿仔技能 fallback |
| yizai | `yizai_hero_ultimate.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_ultimate` | `available=false`，使用亿仔大招 fallback |
| yizai | `yizai_hero_hurt.png` | `public/assets/fairy/yizai/` | 512x512 | 是 | MVP 正式美术必须 | `yizai_hero_hurt` | `available=false`，使用亿仔受击 fallback |
| monsters | `monster_slime_idle.png` | `public/assets/fairy/monsters/` | 384x384 | 是 | MVP 正式美术必须 | `monster_slime_idle` | `available=false`，使用史莱姆 fallback |
| monsters | `monster_slime_hit.png` | `public/assets/fairy/monsters/` | 384x384 | 是 | MVP 正式美术必须 | `monster_slime_hit` | `available=false`，使用史莱姆受击 fallback |
| monsters | `monster_slime_attack.png` | `public/assets/fairy/monsters/` | 384x384 | 是 | MVP 正式美术必须 | `monster_slime_attack` | `available=false`，使用史莱姆攻击 fallback |
| monsters | `monster_slime_defeat.png` | `public/assets/fairy/monsters/` | 384x384 | 是 | MVP 正式美术必须 | `monster_slime_defeat` | `available=false`，使用史莱姆退场 fallback |

## 当前 fallback 状态

- `fairySkin.resources` 已为第一批资源保留路径和 fallback 信息。
- 当前所有正式 PNG 资源仍保持 `available=false`。
- 图片不存在时，页面使用 CSS fallback 和占位文案，不应崩溃。
- Window I 放入正式 PNG 后，再逐项把确认可用的资源标记为 `available=true`。

## 接入后验证

1. 将正式 PNG 放入对应目录，文件名必须与上表一致。
2. 检查亿仔资源：白熊主体、粗黑眉、橙黄色口鼻区、黑鼻、正向可见 `MAEE`。
3. 将已通过目检的资源在 `fairySkin` 对应 resource 上标记为可用。
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
