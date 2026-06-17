from __future__ import annotations

import os
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_BUILD = PROJECT_ROOT / "dist"
LAUNCHER = Path(__file__).resolve().parent / "match3_yizai_launcher.py"
BUILD_ROOT = PROJECT_ROOT / "artifacts" / "desktop-local-app-build"
ICON_PATH = BUILD_ROOT / "match3_yizai.ico"
DIST_PATH = BUILD_ROOT / "pyinstaller-dist"
WORK_PATH = BUILD_ROOT / "pyinstaller-work"
SPEC_PATH = BUILD_ROOT / "pyinstaller-spec"
SHARE_DIR_NAME = "亿仔三消_发给同事"
EXE_NAME = "亿仔三消_本地版.exe"


def desktop_dir() -> Path:
    user_profile = os.environ.get("USERPROFILE")
    if not user_profile:
        raise RuntimeError("Cannot find USERPROFILE for Desktop output.")
    return Path(user_profile) / "Desktop"


def npm_command() -> str:
    command = shutil.which("npm.cmd") or shutil.which("npm")
    if not command:
        raise RuntimeError("Cannot find npm. Please install Node.js first.")
    return command


def run_frontend_build() -> None:
    subprocess.check_call([npm_command(), "exec", "vite", "--", "build"], cwd=PROJECT_ROOT)


def first_existing(paths: list[Path]) -> Path:
    for path in paths:
        if path.exists():
            return path
    raise FileNotFoundError(paths[0])


def make_icon() -> None:
    source_icon = first_existing(
        [
            PROJECT_ROOT / "public" / "assets" / "fairy" / "yizai" / "yizai_hero_idle.png",
            PROJECT_ROOT / "public" / "assets" / "fairy" / "pieces" / "piece_yellow_star.png",
        ]
    )
    ICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    image = Image.open(source_icon).convert("RGBA")
    image.save(
        ICON_PATH,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def build_exe() -> Path:
    if not (SOURCE_BUILD / "index.html").exists():
        raise FileNotFoundError(SOURCE_BUILD / "index.html")

    DIST_PATH.mkdir(parents=True, exist_ok=True)
    WORK_PATH.mkdir(parents=True, exist_ok=True)
    SPEC_PATH.mkdir(parents=True, exist_ok=True)

    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name",
        "match3_yizai_local",
        "--icon",
        str(ICON_PATH),
        "--add-data",
        f"{SOURCE_BUILD}{os.pathsep}dist",
        "--distpath",
        str(DIST_PATH),
        "--workpath",
        str(WORK_PATH),
        "--specpath",
        str(SPEC_PATH),
        str(LAUNCHER),
    ]
    subprocess.check_call(command, cwd=PROJECT_ROOT)
    built_exe = DIST_PATH / "match3_yizai_local.exe"
    if not built_exe.exists():
        raise FileNotFoundError(built_exe)
    return built_exe


def write_instructions(share_dir: Path) -> None:
    instructions = (
        "使用说明\r\n"
        "1. 先把整个文件夹解压/复制到电脑上。\r\n"
        "2. 双击“亿仔三消_本地版.exe”。\r\n"
        "3. 程序会自动打开浏览器并进入游戏；不需要安装 Node 或其他开发工具。\r\n"
        "4. 如果 Windows 弹出安全提示，点“更多信息”，再点“仍要运行”。\r\n"
        "5. 游戏窗口关闭后，后台本地服务会在空闲一段时间后自动退出。\r\n"
    )
    (share_dir / "使用说明.txt").write_text(instructions, encoding="utf-8")


def copy_to_share_dir(built_exe: Path) -> tuple[Path, Path]:
    share_dir = desktop_dir() / SHARE_DIR_NAME
    share_dir.mkdir(parents=True, exist_ok=True)
    target_exe = share_dir / EXE_NAME
    shutil.copy2(built_exe, target_exe)
    write_instructions(share_dir)

    zip_base = desktop_dir() / SHARE_DIR_NAME
    zip_path = Path(shutil.make_archive(str(zip_base), "zip", root_dir=desktop_dir(), base_dir=SHARE_DIR_NAME))
    return target_exe, zip_path


def main() -> int:
    run_frontend_build()
    make_icon()
    built_exe = build_exe()
    target_exe, zip_path = copy_to_share_dir(built_exe)
    print(target_exe)
    print(zip_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
