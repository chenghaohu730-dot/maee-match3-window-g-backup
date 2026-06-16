from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


SOURCE_SHEET = Path(r"D:\05_素材资料\三消\亿仔\序列帧\yizai_hero_attack_sheet.png")
OUTPUT_DIR = Path(r"D:\01_Codex源码项目\三消游戏\public\assets\fairy\yizai")
ARTIFACT_DIR = Path(r"D:\01_Codex源码项目\三消游戏\artifacts")

SHEET_OUT = OUTPUT_DIR / "yizai_hero_attack_sheet.png"
FALLBACK_OUT = OUTPUT_DIR / "yizai_hero_attack.png"
PREVIEW_OUT = ARTIFACT_DIR / "yizai_attack_manual_preview.png"

FRAME_COUNT = 6
TARGET = 512

# Adjust these values.
# SCALE controls the full animation size.
# OFFSET_X: positive moves right, negative moves left.
# OFFSET_Y: positive moves down, negative moves up.
SCALE = 1.0
OFFSET_X = 0
OFFSET_Y = 0

# Per-frame overrides: (scale, x, y), frame 1 to frame 6.
PER_FRAME = [
    (1.0, 0, 0),
    (1.0, 0, 0),
    (1.0, 0, 0),
    (1.0, 0, 0),
    (1.0, 0, 0),
    (1.0, 0, 0),
]

# Extra padding around each detected frame before fitting to 512x512.
PADDING = 10


def chroma_key(cell: Image.Image) -> Image.Image:
    arr = np.asarray(cell.convert("RGB")).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    dominance = g - np.maximum(r, b)

    hard = (g > 118) & (r < 150) & (b < 155) & (dominance > 52)
    soft = (g > 96) & (r < 188) & (b < 188) & (dominance > 24)

    alpha = np.full(g.shape, 255.0, dtype=np.float32)
    alpha[soft] = np.minimum(alpha[soft], 255.0 - (dominance[soft] - 24.0) * 8.5)
    alpha[hard] = 0.0
    alpha = np.clip(alpha, 0, 255)

    keep = alpha > 0
    limit = np.maximum(r, b) * 0.94 + 28.0
    spill = keep & (g > limit) & (dominance > 12)
    arr[..., 1][spill] = np.minimum(g[spill], limit[spill])

    rgba = np.dstack([arr[..., 0], arr[..., 1], arr[..., 2], alpha]).astype(
        np.uint8
    )
    out = Image.fromarray(rgba, "RGBA")
    feather = out.getchannel("A").filter(ImageFilter.GaussianBlur(0.3))
    feather_arr = np.asarray(feather).astype(np.uint8)
    feather_arr[alpha == 0] = 0
    out.putalpha(Image.fromarray(feather_arr, "L"))
    return out


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    alpha = np.asarray(img.getchannel("A"))
    ys, xs = np.where(alpha > 10)
    if len(xs) == 0:
        return (0, 0, img.width, img.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def crop_with_padding(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = box
    out = Image.new("RGBA", (right - left, bottom - top), (0, 0, 0, 0))
    src_left = max(left, 0)
    src_top = max(top, 0)
    src_right = min(right, img.width)
    src_bottom = min(bottom, img.height)

    if src_right > src_left and src_bottom > src_top:
        out.alpha_composite(
            img.crop((src_left, src_top, src_right, src_bottom)),
            (src_left - left, src_top - top),
        )

    return out


def make_checker(size: tuple[int, int], tile: int = 24) -> Image.Image:
    bg = Image.new("RGBA", size, (235, 235, 235, 255))
    draw = ImageDraw.Draw(bg)

    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            fill = (
                (250, 250, 250, 255)
                if ((x // tile + y // tile) % 2 == 0)
                else (218, 218, 218, 255)
            )
            draw.rectangle(
                (x, y, min(x + tile - 1, size[0] - 1), min(y + tile - 1, size[1] - 1)),
                fill=fill,
            )

    return bg


def build_frames() -> list[Image.Image]:
    source = Image.open(SOURCE_SHEET).convert("RGB")
    edges = [round(i * source.width / FRAME_COUNT) for i in range(FRAME_COUNT + 1)]
    frames: list[Image.Image] = []

    for index in range(FRAME_COUNT):
        cell = source.crop((edges[index], 0, edges[index + 1], source.height))
        keyed = chroma_key(cell)
        left, top, right, bottom = alpha_bbox(keyed)
        cropped = crop_with_padding(
            keyed,
            (
                left - PADDING,
                top - PADDING,
                right + PADDING,
                bottom + PADDING,
            ),
        )

        frame_scale, frame_x, frame_y = PER_FRAME[index]
        scale = (
            min((TARGET - 8) / cropped.width, (TARGET - 8) / cropped.height)
            * SCALE
            * frame_scale
        )
        resized_size = (
            max(1, round(cropped.width * scale)),
            max(1, round(cropped.height * scale)),
        )
        resized = cropped.resize(resized_size, Image.Resampling.LANCZOS)

        canvas = Image.new("RGBA", (TARGET, TARGET), (0, 0, 0, 0))
        x = (TARGET - resized.width) // 2 + OFFSET_X + frame_x
        y = TARGET - resized.height - 2 + OFFSET_Y + frame_y
        canvas.alpha_composite(resized, (x, y))
        frames.append(canvas)

    return frames


def save_outputs(frames: list[Image.Image]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    sheet = Image.new("RGBA", (TARGET * FRAME_COUNT, TARGET), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * TARGET, 0))

    sheet.save(SHEET_OUT, optimize=True)
    frames[0].save(FALLBACK_OUT, optimize=True)

    preview = make_checker(sheet.size)
    preview.alpha_composite(sheet)
    draw = ImageDraw.Draw(preview)
    for index in range(FRAME_COUNT):
        center_x = index * TARGET + TARGET // 2
        draw.line((center_x, 0, center_x, TARGET), fill=(255, 0, 0, 180), width=2)
    preview.convert("RGB").save(PREVIEW_OUT)

    print(f"sheet: {SHEET_OUT} ({sheet.width}x{sheet.height})")
    print(f"fallback: {FALLBACK_OUT} ({TARGET}x{TARGET})")
    print(f"preview: {PREVIEW_OUT}")


if __name__ == "__main__":
    save_outputs(build_frames())
