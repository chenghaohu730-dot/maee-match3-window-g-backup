import assert from "node:assert/strict";
import test from "node:test";
import { resolveGameplayDebugMode } from "../src/ui/debugMode.ts";

test("normal entry does not enable gameplay debug mode", () => {
  assert.equal(resolveGameplayDebugMode(null), undefined);
  assert.equal(resolveGameplayDebugMode("animation-calibration"), undefined);
});

test("state-lab and battle-lab enable the debug panel", () => {
  assert.equal(resolveGameplayDebugMode("state-lab"), "state-lab");
  assert.equal(resolveGameplayDebugMode("battle-lab"), "battle-lab");
});
