export interface QrOptions {
  size: number;
  fgColor: string;
  bgColor: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
}

export abstract class QrImageGenerator {
  abstract generate(encodedContent: string, options: QrOptions): Promise<{ png: Buffer; svg: string }>;
}
