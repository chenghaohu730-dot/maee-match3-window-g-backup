import assert from "node:assert/strict";
import test from "node:test";
import {
  applyScoreProgress,
  createDefaultProgress,
  isUniverseUnlocked,
  loadPlayerProgress,
  savePlayerProgress,
  type StorageLike,
} from "../src/ui/progressionStore.ts";
import {
  nextSceneForStartButton,
  selectUniverse,
} from "../src/ui/sceneState.ts";

test("start page primary button routes to the universe page", () => {
  assert.equal(nextSceneForStartButton(), "universe");
});

test("fairy-tale universe is unlocked by default and enters gameplay", () => {
  const progress = createDefaultProgress();
  const result = selectUniverse(progress, "fairy-tale");

  assert.equal(isUniverseUnlocked(progress, "fairy-tale"), true);
  assert.deepEqual(result, { scene: "gameplay", modal: null });
});

test("locked universes stay on universe page and request points", () => {
  const progress = createDefaultProgress();
  const result = selectUniverse(progress, "work");

  assert.equal(isUniverseUnlocked(progress, "work"), false);
  assert.deepEqual(result, { scene: "universe", modal: "locked" });
});

test("score progress preserves high score and accumulates points", () => {
  const progress = applyScoreProgress(createDefaultProgress(), 120, 120);
  const next = applyScoreProgress(progress, 30, 150);

  assert.equal(next.highestScore, 150);
  assert.equal(next.totalPoints, 150);
  assert.deepEqual(next.unlockedUniverses, ["fairy-tale"]);
});

test("progress storage uses the required local storage keys", () => {
  const storage = new MemoryStorage();
  savePlayerProgress(
    {
      highestScore: 900,
      totalPoints: 1200,
      unlockedUniverses: ["fairy-tale", "work"],
    },
    storage,
  );

  const loaded = loadPlayerProgress(storage);

  assert.equal(storage.getItem("highestScore"), "900");
  assert.equal(storage.getItem("totalPoints"), "1200");
  assert.deepEqual(loaded, {
    highestScore: 900,
    totalPoints: 1200,
    unlockedUniverses: ["fairy-tale", "work"],
  });
});

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
