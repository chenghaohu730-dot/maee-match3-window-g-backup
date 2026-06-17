import type { AssetKey } from "./assetManifest.ts";
import {
  RESOURCE_BY_ID,
  RESOURCE_MANIFEST,
  type GameResourceEntry,
  type PreloadPolicy,
  type ResourceLayer,
} from "./resourceManifest.ts";

export type ResourceStatus = "idle" | "loading" | "loaded" | "failed";

export interface ResourceLoadItem {
  id: string;
  status: ResourceStatus;
  requestedUrl: string;
  resolvedUrl: string;
  fallbackUsed: boolean;
}

export interface ResourceLoadSummary {
  total: number;
  loaded: number;
  failed: number;
  fallbackUsed: number;
  resources: ResourceLoadItem[];
}

type ResourceLoadAdapter = (
  url: string,
  entry: GameResourceEntry,
) => Promise<void>;

interface ResourceRecord {
  status: ResourceStatus;
  url?: string;
  error?: string;
}

const records = new Map<string, ResourceRecord>();
const inFlight = new Map<string, Promise<string>>();
let loadAdapter: ResourceLoadAdapter | undefined;

export async function loadResource(id: string): Promise<string> {
  return loadResourceInternal(id, new Set<string>());
}

export async function loadLayer(
  layer: ResourceLayer,
): Promise<ResourceLoadSummary> {
  return loadEntries(RESOURCE_MANIFEST.filter((entry) => entry.layer === layer));
}

export async function preloadForStartup(): Promise<ResourceLoadSummary> {
  return loadEntries(
    RESOURCE_MANIFEST.filter(
      (entry) => entry.preloadPolicy === "startup" || entry.requiredForStart,
    ),
  );
}

export async function preloadForFairy(): Promise<ResourceLoadSummary> {
  return loadEntries(
    RESOURCE_MANIFEST.filter(
      (entry) =>
        entry.layer === "common" ||
        entry.layer === "fairy-base" ||
        entry.preloadPolicy === "before-fairy",
    ),
  );
}

export async function preloadForWave(
  waveId: string,
): Promise<ResourceLoadSummary> {
  return loadEntries(
    RESOURCE_MANIFEST.filter(
      (entry) =>
        entry.preloadPolicy === "before-wave" &&
        (entry.waveIds?.includes(waveId) ?? false),
    ),
  );
}

export async function preloadForEndless(): Promise<ResourceLoadSummary> {
  return loadEntries(
    RESOURCE_MANIFEST.filter(
      (entry) =>
        entry.layer === "endless" || entry.preloadPolicy === "before-endless",
    ),
  );
}

export function getResourceUrl(id: string): string {
  const entry = getEntry(id);

  if (!entry) {
    return "";
  }

  const record = records.get(id);

  if (record?.status === "loaded" && record.url) {
    return record.url;
  }

  if (record?.status === "failed" && entry.fallbackId) {
    return getResourceUrl(entry.fallbackId);
  }

  return entry.localUrl;
}

export function getResourceStatus(id: string): ResourceStatus {
  return records.get(id)?.status ?? "idle";
}

export function resetResourceLoaderForTests(): void {
  records.clear();
  inFlight.clear();
  loadAdapter = undefined;
}

export function setResourceLoadAdapterForTests(
  adapter: ResourceLoadAdapter | undefined,
): void {
  records.clear();
  inFlight.clear();
  loadAdapter = adapter;
}

async function loadEntries(
  entries: readonly GameResourceEntry[],
): Promise<ResourceLoadSummary> {
  const resources = await Promise.all(
    entries.map(async (entry) => {
      const resolvedUrl = await loadResource(entry.id);
      const status = resolvedUrl ? "loaded" : getResourceStatus(entry.id);
      const originalStatus = getResourceStatus(entry.id);

      return {
        id: entry.id,
        status,
        requestedUrl: entry.localUrl,
        resolvedUrl,
        fallbackUsed: originalStatus === "failed" && resolvedUrl.length > 0,
      } satisfies ResourceLoadItem;
    }),
  );

  return {
    total: resources.length,
    loaded: resources.filter((resource) => resource.resolvedUrl.length > 0).length,
    failed: resources.filter((resource) => resource.resolvedUrl.length === 0).length,
    fallbackUsed: resources.filter((resource) => resource.fallbackUsed).length,
    resources,
  };
}

async function loadResourceInternal(
  id: string,
  visited: Set<string>,
): Promise<string> {
  const entry = getEntry(id);

  if (!entry) {
    records.set(id, {
      status: "failed",
      error: `Unknown resource id: ${id}`,
    });
    warnResourceFailure(id, "unknown resource id");
    return "";
  }

  const current = records.get(id);
  if (current?.status === "loaded" && current.url) {
    return current.url;
  }

  const pending = inFlight.get(id);
  if (pending) {
    return pending;
  }

  const promise = performLoad(entry, visited).finally(() => {
    inFlight.delete(id);
  });

  inFlight.set(id, promise);
  return promise;
}

async function performLoad(
  entry: GameResourceEntry,
  visited: Set<string>,
): Promise<string> {
  if (visited.has(entry.id)) {
    records.set(entry.id, {
      status: "failed",
      error: "fallback cycle",
    });
    warnResourceFailure(entry.id, "fallback cycle");
    return "";
  }

  visited.add(entry.id);
  records.set(entry.id, { status: "loading" });

  const url = getPreferredWebUrl(entry);

  try {
    await assertUrlLoadable(url, entry);
    records.set(entry.id, { status: "loaded", url });
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    records.set(entry.id, { status: "failed", error: message });
    warnResourceFailure(entry.id, message);

    if (entry.fallbackId) {
      return loadResourceInternal(entry.fallbackId, visited);
    }

    return "";
  }
}

function getPreferredWebUrl(entry: GameResourceEntry): string {
  return entry.localUrl;
}

async function assertUrlLoadable(
  url: string,
  entry: GameResourceEntry,
): Promise<void> {
  if (loadAdapter) {
    await loadAdapter(url, entry);
    return;
  }

  if (
    typeof window === "undefined" ||
    typeof Image === "undefined" ||
    !isImageLike(entry)
  ) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`failed to load ${url}`));
    image.src = url;
  });
}

function isImageLike(entry: GameResourceEntry): boolean {
  return (
    entry.type === "image" ||
    entry.type === "spritesheet" ||
    entry.type === "background" ||
    entry.type === "ui" ||
    entry.type === "vfx"
  );
}

function getEntry(id: string): GameResourceEntry | undefined {
  return RESOURCE_BY_ID[id as AssetKey];
}

function warnResourceFailure(id: string, reason: string): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") {
    return;
  }

  console.warn(`[resource-loader] ${id} fallback used: ${reason}`);
}
