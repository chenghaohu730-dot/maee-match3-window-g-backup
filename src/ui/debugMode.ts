export type GameplayDebugMode = "state-lab" | "battle-lab";

export function resolveGameplayDebugMode(
  value: string | null,
): GameplayDebugMode | undefined {
  if (value === "state-lab" || value === "battle-lab") {
    return value;
  }

  return undefined;
}
