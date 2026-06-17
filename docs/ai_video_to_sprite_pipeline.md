# AI 视频转 Sprite Sheet 资源管线

当前角色动画路线改为离线 AI 视频资源生产：AI 视频生成动作、抽帧、绿幕抠图、主体对齐、统一 `512x512`、合成 sprite sheet，最后由游戏现有 pro sheet 优先级读取。游戏运行时不引入实时 3D、不引入 three.js，也不修改玩法逻辑。

本管线当前采用“效果优先版”规格：用更高帧数和更高 FPS 换取更平滑的待机、攻击、技能和大招表现。代价是 pro sheet 文件会比轻量版更大，后续如需做包体优化，再单独评估压缩 PNG、WebP 运行时支持或动作分级加载。

## AI 视频生成要求

- 纯绿幕背景，默认 key color 为 `#00ff00`。
- 固定镜头，固定机位，不要镜头运动。
- 全身入镜，面向右。
- 不要字幕、贴纸、水印或 UI 文案。
- 不要切镜，不要角色出框。
- 动作主体尽量在画面中心，脚底不要离底边太近。
- 亿仔必须保留白熊主体、橙黄色口鼻区、黑色大鼻子、粗眉毛。
- 头部装饰物正面可见区域必须清楚显示 `MAEE`，尽量不要被动作、剑、特效、景深或运动模糊遮挡。

## 视频命名

把视频放到：

```text
assets-src/yizai_video/input/
```

文件名固定为：

```text
yizai_idle.mp4
yizai_attack.mp4
yizai_skill.mp4
yizai_ultimate.mp4
yizai_hurt.mp4
```

支持 `.mp4`、`.mov`、`.webm`，如需改文件名或使用手动抽帧时间点，在 `tools/video/videoToSpriteConfig.ts` 调整对应动作配置。

## 抽帧区间

AI 视频开头和结尾经常会有静止帧或动作未进入主体的缓冲段。每个动作都可以在 `tools/video/videoToSpriteConfig.ts` 设置：

```ts
sampleStartTime: 0.2,
sampleEndTime: 1.4,
```

- 如果 `sampleStartTime` 或 `sampleEndTime` 存在，工具只在该时间段内均匀抽帧。
- 如果两个字段都不存在，工具才会对整段视频均匀抽帧。
- `sampleStartTime` 和 `sampleEndTime` 使用秒为单位。
- 先用播放器或 debug 抽帧确认动作主体区间，再避开视频开头和结尾的无效静止帧。

推荐先用以下区间作为起点，再按实际视频微调：

| 动作 | 推荐起点 |
| --- | --- |
| idle | 保留完整循环主体，避开开头角色站定前的缓冲 |
| attack | 从抬手前一瞬开始，到攻击收势结束 |
| skill | 从蓄力开始，到技能特效结束且角色未出框 |
| ultimate | 从大招起手开始，到主特效完全收束 |
| hurt | 从受击前一瞬开始，到回弹结束 |

## 动作规格

| 动作 | 帧数 | FPS | 单帧 | Sheet 网格 | 循环 |
| --- | ---: | ---: | --- | --- | --- |
| idle | 12 | 12 | `512x512` | 6 列 2 行 | true |
| attack | 16 | 20 | `512x512` | 8 列 2 行 | false |
| skill | 24 | 20 | `512x512` | 8 列 3 行 | false |
| ultimate | 32 | 24 | `512x512` | 8 列 4 行 | false |
| hurt | 12 | 20 | `512x512` | 6 列 2 行 | false |

## Sheet 尺寸

| 动作 | Sheet 尺寸 |
| --- | --- |
| idle | `3072x1024` |
| attack | `4096x1024` |
| skill | `4096x1536` |
| ultimate | `4096x2048` |
| hurt | `3072x1024` |

不要把这些动作重新做成单行超宽图；构建和校验脚本会按配置里的 `columns` / `rows` 检查尺寸。

## 运行方式

完整管线：

```sh
npm run video:pipeline
```

只处理普通攻击：

```sh
npm run video:pipeline -- --action attack
```

如果当前终端不方便传参，也可以用环境变量：

```sh
ACTION=attack npm run video:pipeline
```

Windows `cmd` 可用：

```bat
set ACTION=attack&& npm run video:pipeline
```

也可以分步运行：

```sh
npm run video:extract
npm run video:cutout
npm run video:align
npm run video:build-sheets
npm run video:validate
```

抽帧依赖本机安装 `ffmpeg` 和 `ffprobe`。如果没有安装，先安装 ffmpeg，或设置 `FFMPEG_PATH`、`FFPROBE_PATH` 指向可执行文件。

## Attack 视频处理示例

1. 放入 `assets-src/yizai_video/input/yizai_attack.mp4`。
2. 运行：

```sh
npm run video:pipeline -- --action attack
```

3. 临时抽帧输出到：

```text
assets-src/yizai_video/extracted/attack/frame_0001.png
```

4. 抠图中间帧输出到：

```text
assets-src/yizai_video/extracted/attack_cutout/frame_0001.png
```

5. 对齐后的游戏帧输出到：

```text
assets-src/yizai_video/renders/attack/frame_0001.png
```

6. 最终 sheet 输出到：

```text
public/assets/fairy/yizai/pro/yizai_hero_attack_sheet.png
```

## 调绿幕参数

在 `tools/video/videoToSpriteConfig.ts` 的对应动作里调整 `chromaKey`：

```ts
chromaKey: {
  keyColor: "#00ff00",
  tolerance: 70,
  edgeFeather: 1.5,
  despill: true,
}
```

- `keyColor`：绿幕颜色。
- `tolerance`：越大，越多接近绿幕的颜色会被去掉。
- `edgeFeather`：边缘过渡范围，越大边缘越软。
- `despill`：去绿色溢色，默认开启。

抠图 debug 对比图在：

```text
assets-src/yizai_video/debug/<action>/*_cutout_debug.png
```

左侧是原图，右侧是透明结果铺在棋盘格背景上的预览。

## 调脚底基准线

在 `tools/video/videoToSpriteConfig.ts` 的对应动作里调整 `alignment`：

```ts
alignment: {
  canvasWidth: 512,
  canvasHeight: 512,
  baselineY: 470,
  padding: 32,
  xOffset: 0,
  allowRightEffectSpace: false,
}
```

- `baselineY`：脚底对齐线，默认 `470`。
- `padding`：主体外接框安全边距，避免裁掉帽子、披风、剑和特效。
- `xOffset`：水平偏移。普通攻击默认略偏左，给右侧剑气留空间。
- `allowRightEffectSpace`：开启后横向可用空间更偏向保留右侧特效。

对齐 bbox 数据在：

```text
assets-src/yizai_video/debug/<action>/<action>_align_bboxes.json
```

## 接入游戏

最终输出写入：

```text
public/assets/fairy/yizai/pro/yizai_hero_idle_sheet.png
public/assets/fairy/yizai/pro/yizai_hero_attack_sheet.png
public/assets/fairy/yizai/pro/yizai_hero_skill_sheet.png
public/assets/fairy/yizai/pro/yizai_hero_ultimate_sheet.png
public/assets/fairy/yizai/pro/yizai_hero_hurt_sheet.png
```

游戏已有资源优先级：优先读取 `pro` sheet；没有 pro sheet 时继续使用 `public/assets/fairy/yizai/*_sheet.png` 和静态 PNG fallback。这个管线不会删除旧资源，也不会覆盖 fallback。

## Window R3 当前资源记录

当前五个亿仔动作资源来源为 AI 视频抽帧测试版，已接入 `public/assets/fairy/yizai/pro/` 下的 pro sprite sheet。播放配置仍以 `src/ui/characterAnimationConfig.ts` 为准：

| 动作 | 帧数 | Sheet 尺寸 | 播放 FPS | 循环 | 资源来源 |
| --- | ---: | --- | ---: | --- | --- |
| idle | 12 | `3072x1024` | 12 | true | AI 视频抽帧测试版 |
| attack | 16 | `4096x1024` | 20 | false | AI 视频抽帧测试版 |
| skill | 24 | `4096x1536` | 20 | false | AI 视频抽帧测试版 |
| ultimate | 32 | `4096x2048` | 24 | false | AI 视频抽帧测试版 |
| hurt | 12 | `3072x1024` | 20 | false | AI 视频抽帧测试版 |

怪物本窗口不接入序列帧，继续使用静态状态图策略：`monster_slime_idle`、`monster_slime_hit`、`monster_slime_attack`、`monster_slime_defeat`。表现层通过静态图切换配合轻微呼吸、受击抖动、攻击前冲和退场缩放淡出完成反馈；缺失的 `monster_slime_xxx_sheet` 不应阻塞亿仔 pro sheet 播放。

## 校验

```sh
npm run video:validate
```

校验会检查 sheet 是否存在、是否 PNG、尺寸是否符合规格、是否有 alpha 通道、帧数和单帧尺寸是否匹配、文件体积是否异常。尚未生成的动作只给 warning，不阻塞开发；已生成但尺寸或格式错误会给 error。

## 体积优化

效果优先版会明显增加 PNG 体积。若后续包体压力变大，优先考虑：

- 重新裁剪 `sampleStartTime` / `sampleEndTime`，减少无效帧。
- 检查对齐后的透明边距，避免主体过小导致大片空白仍占 sheet 面积。
- 在不影响边缘透明的前提下做 PNG 无损压缩。
- 分动作懒加载或只在正式资源包启用 pro sheet。
- 评估运行环境是否允许 WebP 等更高压缩格式；未确认前不要替换现有 PNG 路径。
