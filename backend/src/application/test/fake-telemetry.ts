import { Telemetry, TelemetryEvent } from '../../domain/shared/telemetry';

/** Records every captured event, for specs. */
export class FakeTelemetry extends Telemetry {
  readonly captured: { event: TelemetryEvent }[] = [];

  capture(event: TelemetryEvent): void {
    this.captured.push({ event });
  }

  names(): string[] {
    return this.captured.map(({ event }) => event.name);
  }
}
