import {getAdSlotGeometry} from '../src/Ads/AdViewportGeometry';

describe('ad viewport geometry', () => {
  const viewport = {x: 20, y: 100, width: 320, height: 600};
  it('prefetches within half the viewport, using the same window coordinates', () => {
    expect(getAdSlotGeometry({x: 20, y: 1000, width: 320, height: 0}, viewport)).toMatchObject({
      distanceToSlot: 300, prefetchDistance: 300, nearViewport: true, visible: false,
    });
    expect(getAdSlotGeometry({x: 20, y: 1001, width: 320, height: 0}, viewport)?.nearViewport).toBe(false);
    expect(getAdSlotGeometry({x: 20, y: 550, width: 320, height: 100}, viewport)?.visible).toBe(true);
  });
  it.each([[300, 200], [1000, 400]])('bounds the threshold for a %i dp viewport', (height, threshold) => {
    expect(getAdSlotGeometry({x: 20, y: 100, width: 320, height: 0}, {...viewport, height})?.prefetchDistance).toBe(threshold);
  });
  it('excludes an offscreen Drawer, a slot already above the viewport, and invalid measurements', () => {
    expect(getAdSlotGeometry({x: -340, y: 110, width: 320, height: 100}, viewport)?.nearViewport).toBe(false);
    expect(getAdSlotGeometry({x: 20, y: -100, width: 320, height: 100}, viewport)?.nearViewport).toBe(false);
    expect(getAdSlotGeometry({x: 20, y: NaN, width: 320, height: 100}, viewport)).toBeNull();
    expect(getAdSlotGeometry({x: 20, y: 110, width: 320, height: 100}, {...viewport, height: 0})).toBeNull();
  });
  it('requires meaningful visibility, including a card taller than the viewport at large font sizes', () => {
    expect(getAdSlotGeometry({x: 20, y: 699, width: 320, height: 100}, viewport)?.visible).toBe(false);
    expect(getAdSlotGeometry({x: 20, y: 650, width: 320, height: 100}, viewport)?.visible).toBe(true);
    expect(getAdSlotGeometry({x: 20, y: 200, width: 320, height: 1200}, viewport)?.visible).toBe(true);
  });
});
