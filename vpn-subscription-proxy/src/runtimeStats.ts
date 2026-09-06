export type RuntimeStatsSnapshot = Readonly<{
  successfulVerifyRequests: number;
  successfulDemoRequests: number;
  failedRequests: number;
  uptime: Readonly<{
    days: number;
    hours: number;
    minutes: number;
    formatted: string;
  }>;
}>;

/** In-memory operational counters; each service restart intentionally resets them. */
export class RuntimeStats {
  private successfulVerifyRequests = 0;
  private successfulDemoRequests = 0;
  private failedRequests = 0;

  public constructor(private readonly startedAt = Date.now()) {}

  public recordSuccessfulVerify(): void {
    this.successfulVerifyRequests += 1;
  }

  public recordSuccessfulDemo(): void {
    this.successfulDemoRequests += 1;
  }

  public recordFailedRequest(): void {
    this.failedRequests += 1;
  }

  public snapshot(now = Date.now()): RuntimeStatsSnapshot {
    const totalMinutes = Math.max(0, Math.floor((now - this.startedAt) / 60000));
    const days = Math.floor(totalMinutes / (24 * 60));
    const remainingMinutes = totalMinutes % (24 * 60);
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return {
      successfulVerifyRequests: this.successfulVerifyRequests,
      successfulDemoRequests: this.successfulDemoRequests,
      failedRequests: this.failedRequests,
      uptime: {
        days,
        hours,
        minutes,
        formatted: `${days} суток ${hours} часов ${minutes} минут`,
      },
    };
  }
}
