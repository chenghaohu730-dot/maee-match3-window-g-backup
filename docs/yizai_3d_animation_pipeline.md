# 亿仔 3D 骨骼动画生产流程

本项目运行时仍然播放 2D sprite sheet，不跑实时 3D，不引入 three.js，也不在小游戏里加载 3D 模型。3D 模型、骨骼动画和渲染只存在于资源生产环境，最终进入游戏的是透明背景 PNG 帧打包出的 sprite sheet。

## 生产链路

1. 准备角色参考图。
2. 完成 3D 建模。
3. 整理材质与颜色。
4. 完成骨骼绑定。
5. 制作 idle、attack、skill、ultimate、hurt 动作。
6. 设置固定相机。
7. 设置固定灯光。
8. 渲染透明背景 PNG 帧。
9. 按 `frame_0001.png`、`frame_0002.png` 命名帧序列。
10. 运行 `npm run build:sheets` 打包 sprite sheet。
11. 运行 `npm run validate:sheets` 校验 sprite sheet。
12. 将通过校验的 pro sheet 接入游戏资源表。

## 亿仔模型要求

- 白色圆头熊主体。
- 橙黄色口鼻区。
- 黑色圆鼻。
- 粗黑眉。
- 蓝色童话勇者帽。
- 帽子正面必须清楚显示 `MAEE`。
- 蓝金勇者服。
- 披风。
- 腰带。
- 短剑。
- 动作以右朝向为主，怪物在右侧。

`MAEE` 不可省略、替换、拼错、镜像、倒置或被遮挡。

## 渲染参数

- 每帧 `512x512` PNG。
- 透明背景。
- 统一相机角度。
- 统一灯光。
- 统一脚底基准线。
- 统一角色占画面比例。
- 角色右朝向。
- 不要裁切帽子、披风、剑、特效。
- 特效不要跨帧边界。
- 帽子正面 `MAEE` 必须清楚可读。

## 动作规格

| 动作 | 帧数 | FPS | 循环 |
| --- | ---: | ---: | --- |
| idle | 4 | 6 | 是 |
| attack | 6 | 12 | 否 |
| skill | 8 | 12 | 否 |
| ultimate | 10 | 12 | 否 |
| hurt | 4 | 10 | 否 |

## 帧命名

所有渲染帧必须按顺序命名：

```text
frame_0001.png
frame_0002.png
frame_0003.png
...
```

示例输入：

```text
assets-src/yizai_3d/renders/attack/frame_0001.png
assets-src/yizai_3d/renders/attack/frame_0002.png
```

示例输出：

```text
public/assets/fairy/yizai/pro/yizai_hero_attack_sheet.png
```

## 资源优先级

游戏加载角色动画时按以下顺序选择资源：

1. `public/assets/fairy/yizai/pro/*_sheet.png` 生产版 sprite sheet。
2. `public/assets/fairy/yizai/*_sheet.png` legacy AI sheet fallback。
3. `public/assets/fairy/yizai/*.png` 静态图 fallback。
4. CSS 占位 fallback。

现有 AI 直接生成的 sheet 已标记为 `legacy-ai`，只作为 fallback 或历史备查，不再作为正式生产默认资源。

## 构建与校验

```sh
npm run build:sheets
npm run validate:sheets
```

`build:sheets` 会检查帧数量、命名顺序、单帧尺寸，并输出无损 PNG sheet。`validate:sheets` 会检查文件是否存在、图片尺寸、网格规格、帧数、alpha 通道和文件体积。pro sheet 尚未准备好时只给 warning，不阻塞开发；尺寸、alpha 或网格错误会给 error。

## 验收标准

- 动作连贯。
- 人物不漂。
- 脚底不跳。
- 帽子 `MAEE` 清楚。
- 角色右朝向。
- 抠图干净。
- 游戏播放无拉伸。
- idle、attack、skill、ultimate、hurt 的帧数和 FPS 与配置一致。
