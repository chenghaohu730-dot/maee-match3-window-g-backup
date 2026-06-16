from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
YIZAI_DIR = ROOT / "public" / "assets" / "fairy" / "yizai"
ARTIFACT_DIR = ROOT / "artifacts"
SOURCE_DIR = ARTIFACT_DIR / "yizai_animation_source_sheets"

FRAME_SIZE = 512
ALPHA_THRESHOLD = 10


@dataclass(frozen=True)
class SheetSpec:
    name: str
    frames: int
    normalize: bool = True
    scale: float = 1.0


SHEETS = [
    SheetSpec("attack", 6, normalize=False),
    SheetSpec("idle", 4),
    SheetSpec("hurt", 4),
    SheetSpec("skill", 8, scale=1.48),
    SheetSpec("ultimate", 10, scale=1.45),
]


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    baseline = read_attack_baseline()
    rows: list[tuple[str, Image.Image]] = []

    for spec in SHEETS:
        sheet_path = ensure_source_sheet(spec)
        frames = split_sheet(sheet_path, spec.frames)

        if spec.normalize:
            frames = [
                align_frame_to_baseline(
                    scale_frame_to_baseline(frame, baseline, spec.scale),
                    baseline,
                )
                for frame in frames
            ]
            save_sheet_and_fallback(spec.name, frames)

        rows.append((spec.name, make_preview_row(frames, baseline)))

    save_preview(rows)
    print(f"baseline centerX={baseline.center_x:.1f} footY={baseline.foot_y:.1f}")


def ensure_source_sheet(spec: SheetSpec) -> Path:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    file_name = f"yizai_hero_{spec.name}_sheet.png"
    source_path = SOURCE_DIR / file_name

    if not source_path.exists():
        shutil.copy2(YIZAI_DIR / file_name, source_path)

    return source_path


@dataclass(frozen=True)
class AlignmentBaseline:
    center_x: float
    foot_y: float


def read_attack_baseline() -> AlignmentBaseline:
    frames = split_sheet(YIZAI_DIR / "yizai_hero_attack_sheet.png", 6)
    boxes = [alpha_bbox(frame) for frame in frames]
    centers = [((left + right) / 2) for left, _top, right, _bottom in boxes]
    feet = [bottom for _left, _top, _right, bottom in boxes]

    return AlignmentBaseline(
        center_x=median(centers),
        foot_y=median(feet),
    )


def split_sheet(path: Path, frame_count: int) -> list[Image.Image]:
    sheet = Image.open(path).convert("RGBA")

    if sheet.height != FRAME_SIZE:
        raise ValueError(f"{path.name} has unexpected height {sheet.height}")

    expected_width = FRAME_SIZE * frame_count
    if sheet.width != expected_width:
        raise ValueError(
            f"{path.name} has width {sheet.width}, expected {expected_width}",
        )

    return [
        sheet.crop((index * FRAME_SIZE, 0, (index + 1) * FRAME_SIZE, FRAME_SIZE))
        for index in range(frame_count)
    ]


def alpha_bbox(frame: Image.Image) -> tuple[int, int, int, int]:
    alpha = frame.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0).getbbox()

    if not bbox:
        return (0, 0, FRAME_SIZE, FRAME_SIZE)

    return bbox


def align_frame_to_baseline(
    frame: Image.Image,
    baseline: AlignmentBaseline,
) -> Image.Image:
    left, _top, right, bottom = alpha_bbox(frame)
    center_x = (left + right) / 2
    dx = round(baseline.center_x - center_x)
    dy = round(baseline.foot_y - bottom)

    return translate(frame, dx, dy)


def scale_frame_to_baseline(
    frame: Image.Image,
    baseline: AlignmentBaseline,
    scale: float,
) -> Image.Image:
    if scale == 1.0:
        return frame

    left, top, right, bottom = alpha_bbox(frame)
    cropped = frame.crop((left, top, right, bottom))
    resized = cropped.resize(
        (
            max(1, round(cropped.width * scale)),
            max(1, round(cropped.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    output = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    x = round(baseline.center_x - resized.width / 2)
    y = round(baseline.foot_y - resized.height)

    output.alpha_composite(resized, (x, y))
    return output


def translate(frame: Image.Image, dx: int, dy: int) -> Image.Image:
    output = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    src_left = max(0, -dx)
    src_top = max(0, -dy)
    src_right = min(frame.width, frame.width - max(dx, 0))
    src_bottom = min(frame.height, frame.height - max(dy, 0))
    dest_x = max(0, dx)
    dest_y = max(0, dy)

    if src_right <= src_left or src_bottom <= src_top:
        return output

    output.alpha_composite(
        frame.crop((src_left, src_top, src_right, src_bottom)),
        (dest_x, dest_y),
    )
    return output


def save_sheet_and_fallback(name: str, frames: list[Image.Image]) -> None:
    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))

    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))

    sheet.save(YIZAI_DIR / f"yizai_hero_{name}_sheet.png", optimize=True)
    frames[0].save(YIZAI_DIR / f"yizai_hero_{name}.png", optimize=True)


def make_preview_row(
    frames: list[Image.Image],
    baseline: AlignmentBaseline,
) -> Image.Image:
    scale = 0.25
    row = Image.new(
        "RGBA",
        (round(FRAME_SIZE * len(frames) * scale), round(FRAME_SIZE * scale)),
        (246, 246, 246, 255),
    )
    draw = ImageDraw.Draw(row)
    foot_y = round(baseline.foot_y * scale)

    for index, frame in enumerate(frames):
        resized = frame.resize(
            (round(FRAME_SIZE * scale), round(FRAME_SIZE * scale)),
            Image.Resampling.LANCZOS,
        )
        x = index * resized.width
        row.alpha_composite(resized, (x, 0))
        draw.rectangle((x, 0, x + resized.width - 1, row.height - 1), outline=(210, 210, 210, 255))
        draw.line((x, foot_y, x + resized.width, foot_y), fill=(255, 66, 66, 210), width=1)

    return row


def save_preview(rows: list[tuple[str, Image.Image]]) -> None:
    gap = 16
    label_width = 86
    width = label_width + max(row.width for _name, row in rows)
    height = sum(row.height for _name, row in rows) + gap * (len(rows) - 1)
    preview = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(preview)
    y = 0

    for name, row in rows:
        draw.text((10, y + 8), name, fill=(35, 43, 58, 255))
        preview.alpha_composite(row, (label_width, y))
        y += row.height + gap

    preview.convert("RGB").save(ARTIFACT_DIR / "yizai_animation_alignment_preview.png")


def median(values: list[float]) -> float:
    sorted_values = sorted(values)
    midpoint = len(sorted_values) // 2

    if len(sorted_values) % 2 == 1:
        return sorted_values[midpoint]

    return (sorted_values[midpoint - 1] + sorted_values[midpoint]) / 2


if __name__ == "__main__":
    main()
