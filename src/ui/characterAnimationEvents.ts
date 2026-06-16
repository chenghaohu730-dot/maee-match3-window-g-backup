import type {
  CharacterAnchorConfig,
  CharacterAnimationRuntimeEvent,
  CharacterFrameEvent,
  SpriteAnimationConfig,
} from "./characterAnimationTypes.ts";
import type { CharacterId } from "./characterAnimationTypes.ts";

export const CHARACTER_ANIMATION_EVENT_NAME = "character-animation-event";

export interface CharacterRuntimeEventInput {
  characterId: CharacterId;
  animation: string;
  frame: number;
  frameEvent: CharacterFrameEvent;
  anchors?: CharacterAnchorConfig;
  element?: HTMLElement | null;
}

export function createCharacterRuntimeEvent(
  input: CharacterRuntimeEventInput,
): CharacterAnimationRuntimeEvent {
  const runtimeEvent: CharacterAnimationRuntimeEvent = {
    characterId: input.characterId,
    animation: input.animation,
    frame: input.frame,
    type: input.frameEvent.type,
    key: input.frameEvent.key,
  };

  if (input.frameEvent.anchor) {
    runtimeEvent.anchor = input.frameEvent.anchor;
    const anchorPosition = input.anchors?.[input.frameEvent.anchor];

    if (anchorPosition) {
      runtimeEvent.anchorPosition = anchorPosition;
      const worldPosition = getWorldPosition(input.element, anchorPosition);

      if (worldPosition) {
        runtimeEvent.worldPosition = worldPosition;
      }
    }
  }

  return runtimeEvent;
}

export function collectRuntimeFrameEvents(
  characterId: CharacterId,
  animation: string,
  frame: number,
  config: SpriteAnimationConfig,
  anchors?: CharacterAnchorConfig,
  element?: HTMLElement | null,
): CharacterAnimationRuntimeEvent[] {
  return (config.frameEvents ?? [])
    .filter((event) => event.frame === frame)
    .map((frameEvent) => {
      const input: CharacterRuntimeEventInput = {
        characterId,
        animation,
        frame,
        frameEvent,
      };

      if (anchors) {
        input.anchors = anchors;
      }

      if (element) {
        input.element = element;
      }

      return createCharacterRuntimeEvent(input);
    });
}

export function dispatchCharacterRuntimeEvent(
  target: EventTarget | null | undefined,
  event: CharacterAnimationRuntimeEvent,
): void {
  if (!target || typeof CustomEvent === "undefined") {
    return;
  }

  target.dispatchEvent(
    new CustomEvent<CharacterAnimationRuntimeEvent>(
      CHARACTER_ANIMATION_EVENT_NAME,
      {
        detail: event,
      },
    ),
  );
}

function getWorldPosition(
  element: HTMLElement | null | undefined,
  anchorPosition: { x: number; y: number },
): { x: number; y: number } | undefined {
  if (!element) {
    return undefined;
  }

  const rect = element.getBoundingClientRect();

  return {
    x: rect.left + rect.width * anchorPosition.x,
    y: rect.top + rect.height * anchorPosition.y,
  };
}
