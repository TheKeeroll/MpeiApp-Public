import type {DragoNetPromoOpportunity, DragoNetPromoService} from './DragoNetPromoService';

export type WindowRect = Readonly<{x: number; y: number; width: number; height: number}>;

export const getVisibleAreaFraction = (banner: WindowRect, viewport: WindowRect): number => {
  if (![...Object.values(banner), ...Object.values(viewport)].every(Number.isFinite)
    || banner.width <= 0 || banner.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return 0;
  const width = Math.max(0, Math.min(banner.x + banner.width, viewport.x + viewport.width) - Math.max(banner.x, viewport.x));
  const height = Math.max(0, Math.min(banner.y + banner.height, viewport.y + viewport.height) - Math.max(banner.y, viewport.y));
  return width * height / (banner.width * banner.height);
};

export const isDragoNetPromoRouteVisible = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return true;
  const state = value as {type?: string; default?: string; history?: Array<{type?: string; status?: string}>};
  if (state.type !== 'drawer') return true;
  const history = state.history ?? [];
  for (let index = history.length - 1; index >= 0; index--) {
    const entry = history[index];
    if (entry?.type === 'drawer') return entry.status !== 'open';
  }
  return state.default !== 'open';
};

export class DragoNetPromoImpressionTracker {
  private timer?: ReturnType<typeof setTimeout>;
  private visibleFraction = 0;
  private disposed = false;
  private measurementPending = false;
  private readyToRecord = false;

  constructor(
    private readonly service: DragoNetPromoService,
    private readonly opportunity: DragoNetPromoOpportunity,
    private readonly canRecord: () => boolean,
  ) {}

  beginMeasurement(): void {
    this.measurementPending = true;
  }

  updateVisibility(fraction: number): void {
    this.measurementPending = false;
    this.visibleFraction = fraction;
    if (this.disposed || this.opportunity.counted || !this.opportunity.selected || !Number.isFinite(fraction) || fraction < 0.5 || !this.canRecord()) {
      this.cancelTimer();
      return;
    }
    if (this.readyToRecord) {
      this.service.recordImpression(this.opportunity);
      this.readyToRecord = false;
      return;
    }
    if (typeof this.timer !== 'undefined') return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.disposed && this.visibleFraction >= 0.5 && this.canRecord()) {
        if (this.measurementPending) this.readyToRecord = true;
        else this.service.recordImpression(this.opportunity);
      }
    }, 500);
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
  }

  private cancelTimer(): void {
    if (typeof this.timer !== 'undefined') clearTimeout(this.timer);
    this.timer = undefined;
    this.readyToRecord = false;
  }
}
