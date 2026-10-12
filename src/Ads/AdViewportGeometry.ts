export type AdViewportRect = Readonly<{x: number; y: number; width: number; height: number}>;

export type AdSlotGeometry = Readonly<{
  distanceToSlot: number;
  prefetchDistance: number;
  nearViewport: boolean;
  visible: boolean;
}>;

/** Both rectangles come from measureInWindow, including safe areas and padding. */
export const getAdSlotGeometry = (slot: AdViewportRect, viewport: AdViewportRect): AdSlotGeometry | null => {
  if (![...Object.values(slot), ...Object.values(viewport)].every(Number.isFinite)
    || slot.width <= 0 || slot.height < 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const overlapWidth = Math.min(slot.x + slot.width, viewport.x + viewport.width) - Math.max(slot.x, viewport.x);
  const overlapHeight = Math.min(slot.y + slot.height, viewport.y + viewport.height) - Math.max(slot.y, viewport.y);
  const prefetchDistance = Math.max(200, Math.min(400, viewport.height * .5));
  const distanceToSlot = slot.y - (viewport.y + viewport.height);
  return {
    distanceToSlot,
    prefetchDistance,
    nearViewport: overlapWidth > 0 && slot.y + slot.height >= viewport.y && distanceToSlot <= prefetchDistance,
    // Large accessibility fonts can make a card taller than the viewport.
    visible: overlapWidth >= Math.min(slot.width, viewport.width) * .5
      && overlapHeight >= Math.min(slot.height, viewport.height) * .5 && overlapHeight > 0,
  };
};
