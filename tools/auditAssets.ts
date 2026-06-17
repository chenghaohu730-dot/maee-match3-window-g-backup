import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  LAYER_BUDGETS_KB,
  RESOURCE_MANIFEST,
  type GameResourceEntry,
  type ResourceDelivery,
  type ResourceLayer,
} from "../src/assets/resourceManifest.ts";

interface FileEntry {
  path: string;
  size: number;
}

interface ManifestFileEntry {
  entry: GameResourceEntry;
  path: string;
  size: number;
  exists: boolean;
}

const ROOT = process.cwd();
const ASSET_ROOT = join(ROOT, "public", "assets");
const DIRECTORIES = [
  "public/assets",
  "public/assets/common",
  "public/assets/universe",
  "public/assets/fairy/yizai",
  "public/assets/fairy/yizai/pro",
  "public/assets/fairy/monsters",
  "public/assets/fairy/pieces",
  "public/assets/fairy/board",
  "public/assets/fairy/backgrounds",
  "public/assets/fairy/ui",
  "public/assets/fairy/vfx",
];
const LAYERS: ResourceLayer[] = [
  "common",
  "fairy-base",
  "fairy-waves",
  "yizai-pro",
  "endless",
  "vfx",
];

async function main(): Promise<void> {
  const files = await collectFiles(ASSET_ROOT);
  const manifestFiles = await Promise.all(
    RESOURCE_MANIFEST.map((entry) => resolveManifestFile(entry)),
  );
  const manifestByPath = new Map(
    manifestFiles.map((file) => [toSlash(file.path), file.entry]),
  );
  const directoryRows = await Promise.all(
    DIRECTORIES.map(async (dir) => ({
      dir,
      size: await directorySize(join(ROOT, dir)),
    })),
  );
  const topFiles = [...files].sort((a, b) => b.size - a.size).slice(0, 20);
  const layerRows = LAYERS.map((layer) => {
    const entries = manifestFiles.filter((file) => file.entry.layer === layer);
    const size = entries.reduce((sum, file) => sum + file.size, 0);
    const budgetKB = LAYER_BUDGETS_KB[layer];

    return {
      layer,
      size,
      budgetKB,
      recommendation: recommendLayer(layer, size, budgetKB),
    };
  });
  const overBudgetResources = manifestFiles.filter(
    (file) =>
      file.exists &&
      file.entry.sizeBudgetKB !== undefined &&
      file.size > file.entry.sizeBudgetKB * 1024,
  );
  const missingResources = manifestFiles.filter((file) => !file.exists);

  console.log("# Asset Audit");
  console.log("");
  console.log("## Directory Sizes");
  console.log("");
  console.log("| Directory | Bytes | Size |");
  console.log("| --- | ---: | ---: |");
  for (const row of directoryRows) {
    console.log(`| ${toSlash(row.dir)} | ${row.size} | ${formatSize(row.size)} |`);
  }

  console.log("");
  console.log("## Resource Layer Sizes");
  console.log("");
  console.log("| Layer | Bytes | Size | Budget | Status | Suggestion |");
  console.log("| --- | ---: | ---: | ---: | --- | --- |");
  for (const row of layerRows) {
    const budgetText =
      row.budgetKB === undefined ? "warning-only" : formatSize(row.budgetKB * 1024);
    const status =
      row.budgetKB === undefined
        ? "warning-only"
        : row.size > row.budgetKB * 1024
          ? "over-budget"
          : "ok";

    console.log(
      `| ${row.layer} | ${row.size} | ${formatSize(row.size)} | ${budgetText} | ${status} | ${row.recommendation} |`,
    );
  }

  console.log("");
  console.log("## Top 20 Files");
  console.log("");
  console.log("| File | Bytes | Size | Layer | Suggestion |");
  console.log("| --- | ---: | ---: | --- | --- |");
  for (const file of topFiles) {
    const entry = manifestByPath.get(toSlash(file.path));
    console.log(
      `| ${toSlash(file.path)} | ${file.size} | ${formatSize(file.size)} | ${entry?.layer ?? "untracked"} | ${entry ? recommendResource(entry, file.size, true) : "review"} |`,
    );
  }

  console.log("");
  console.log("## Resource Budget Warnings");
  console.log("");
  console.log("| Resource | Layer | Bytes | Size | Budget | Suggestion |");
  console.log("| --- | --- | ---: | ---: | ---: | --- |");
  if (overBudgetResources.length === 0) {
    console.log("| none | - | 0 | 0 B | - | keep-local |");
  } else {
    for (const file of overBudgetResources) {
      console.log(
        `| ${file.entry.id} | ${file.entry.layer} | ${file.size} | ${formatSize(file.size)} | ${formatSize((file.entry.sizeBudgetKB ?? 0) * 1024)} | ${recommendResource(file.entry, file.size, file.exists)} |`,
      );
    }
  }

  console.log("");
  console.log("## Delivery Candidates");
  console.log("");
  console.log("| Resource | Layer | Delivery | Policy | Fallback | Suggestion |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const file of manifestFiles) {
    const suggestion = recommendResource(file.entry, file.size, file.exists);
    if (
      file.entry.delivery === "keep-local" &&
      suggestion === "keep-local" &&
      file.exists
    ) {
      continue;
    }

    console.log(
      `| ${file.entry.id} | ${file.entry.layer} | ${file.entry.delivery} | ${file.entry.preloadPolicy} | ${file.entry.fallbackId ?? "css"} | ${suggestion} |`,
    );
  }

  console.log("");
  console.log("## Missing Manifest Files");
  console.log("");
  console.log("| Resource | Layer | Local URL | Fallback | Suggestion |");
  console.log("| --- | --- | --- | --- | --- |");
  if (missingResources.length === 0) {
    console.log("| none | - | - | - | keep-local |");
  } else {
    for (const file of missingResources) {
      console.log(
        `| ${file.entry.id} | ${file.entry.layer} | ${file.entry.localUrl} | ${file.entry.fallbackId ?? "css"} | ${recommendResource(file.entry, file.size, file.exists)} |`,
      );
    }
  }
}

async function collectFiles(dir: string): Promise<FileEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: FileEntry[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const info = await stat(fullPath);
    files.push({
      path: relative(ROOT, fullPath),
      size: info.size,
    });
  }

  return files;
}

async function directorySize(dir: string): Promise<number> {
  try {
    const files = await collectFiles(dir);
    return files.reduce((sum, file) => sum + file.size, 0);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return 0;
    }

    throw error;
  }
}

async function resolveManifestFile(
  entry: GameResourceEntry,
): Promise<ManifestFileEntry> {
  const path = localUrlToPath(entry.localUrl);
  const size = await fileSize(path);

  return {
    entry,
    path: relative(ROOT, path),
    size: size ?? 0,
    exists: size !== null,
  };
}

async function fileSize(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function localUrlToPath(localUrl: string): string {
  const cleanPath = localUrl.split("?")[0]?.replace(/^\//, "") ?? localUrl;
  const publicPath = cleanPath.startsWith("assets/")
    ? join("public", cleanPath)
    : cleanPath;

  return join(ROOT, publicPath);
}

function recommendLayer(
  layer: ResourceLayer,
  size: number,
  budgetKB: number | undefined,
): string {
  if (budgetKB !== undefined && size > budgetKB * 1024) {
    return layer === "common" ? "compress" : "subpackage";
  }

  switch (layer) {
    case "common":
      return "keep-local";
    case "fairy-base":
    case "fairy-waves":
      return "subpackage";
    case "yizai-pro":
      return "remote";
    case "endless":
      return "remote";
    case "vfx":
      return "lazy-load";
  }
}

function recommendResource(
  entry: GameResourceEntry,
  size: number,
  exists: boolean,
): ResourceDelivery | "compress" | "css-fallback" {
  if (!exists) {
    return "css-fallback";
  }

  if (entry.sizeBudgetKB !== undefined && size > entry.sizeBudgetKB * 1024) {
    return entry.delivery === "remote" ? "remote" : "compress";
  }

  return entry.delivery;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function toSlash(value: string): string {
  return value.replaceAll("\\", "/");
}

await main();
