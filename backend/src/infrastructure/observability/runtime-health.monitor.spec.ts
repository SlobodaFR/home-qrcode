import type { MockInstance } from 'vitest';
import { Logger } from '@nestjs/common';
import { RuntimeHealthMonitor } from './runtime-health.monitor';

function blockEventLoop(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait on purpose
  }
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('RuntimeHealthMonitor', () => {
  let monitor: RuntimeHealthMonitor;
  let warn: MockInstance;

  beforeEach(() => {
    monitor = new RuntimeHealthMonitor();
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    monitor.start();
  });

  afterEach(() => {
    monitor.stop();
    warn.mockRestore();
  });

  it('has no sample before the first one is taken', () => {
    expect(monitor.lastSample).toBeNull();
  });

  it('measures an event-loop block, reports it and warns on p99', async () => {
    await tick(50);
    blockEventLoop(500);
    await tick(50);

    const sample = monitor.sample();

    expect(sample.lag_max_ms).toBeGreaterThanOrEqual(400);
    expect(sample.elu).toBeGreaterThan(0);
    expect(sample.heap_used_mb).toBeGreaterThan(0);
    expect(sample.rss_mb).toBeGreaterThan(0);
    expect(monitor.lastSample).toEqual(sample);
    expect(JSON.stringify(warn.mock.calls)).toContain('p99');
  });

  it('resets the histogram between samples', async () => {
    await tick(50);
    blockEventLoop(500);
    await tick(50);
    const first = monitor.sample();

    await tick(200);
    const second = monitor.sample();

    expect(second.lag_max_ms).toBeLessThan(first.lag_max_ms / 2);
  });

  it('can be stopped twice, and reports zero lag once stopped', async () => {
    monitor.stop();
    expect(() => {
      monitor.stop();
    }).not.toThrow();

    blockEventLoop(200);
    await tick(20);

    expect(monitor.sample().lag_max_ms).toBe(0);
  });
});
