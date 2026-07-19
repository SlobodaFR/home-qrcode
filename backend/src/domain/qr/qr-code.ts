export interface QrCodeProps {
  id: string;
  userId: string;
  contentType: 'url' | 'text' | 'wifi' | 'email' | 'vcard';
  content: string;
  size: number;
  fgColor: string;
  bgColor: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  createdAt: Date;
  scanCount?: number;
}

export class QrCode {
  private constructor(private readonly props: QrCodeProps) {}

  static create(props: QrCodeProps): QrCode {
    return new QrCode({ ...props, scanCount: props.scanCount ?? 0 });
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get contentType(): 'url' | 'text' | 'wifi' | 'email' | 'vcard' { return this.props.contentType; }
  get content(): string { return this.props.content; }
  get size(): number { return this.props.size; }
  get fgColor(): string { return this.props.fgColor; }
  get bgColor(): string { return this.props.bgColor; }
  get errorCorrection(): 'L' | 'M' | 'Q' | 'H' { return this.props.errorCorrection; }
  get createdAt(): Date { return this.props.createdAt; }
  get scanCount(): number { return this.props.scanCount ?? 0; }
  get pngUrl(): string { return `/api/qr/${this.props.id}/png`; }
  get svgUrl(): string { return `/api/qr/${this.props.id}/svg`; }

  withContent(content: string): QrCode {
    return new QrCode({ ...this.props, content });
  }
}
