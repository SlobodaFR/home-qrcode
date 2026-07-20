export interface QrShareProps {
  id: string;
  qrId: string;
  ownerId: string;
  recipientId: string;
  createdAt: Date;
}

export class QrShare {
  private constructor(private readonly props: QrShareProps) {}

  static create(props: QrShareProps): QrShare {
    return new QrShare(props);
  }

  get id(): string { return this.props.id; }
  get qrId(): string { return this.props.qrId; }
  get ownerId(): string { return this.props.ownerId; }
  get recipientId(): string { return this.props.recipientId; }
  get createdAt(): Date { return this.props.createdAt; }
}
