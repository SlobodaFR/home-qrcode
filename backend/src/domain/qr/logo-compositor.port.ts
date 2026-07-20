export abstract class LogoCompositorPort {
  abstract composite(qrPng: Buffer, logo: Buffer): Promise<Buffer>;
}
