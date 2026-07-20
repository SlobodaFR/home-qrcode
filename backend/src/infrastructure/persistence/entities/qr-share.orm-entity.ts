import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'qr_shares' })
@Unique(['qrId', 'recipientId'])
export class QrShareOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text', name: 'qr_id' })
  qrId!: string;

  @Column({ type: 'text', name: 'owner_id' })
  ownerId!: string;

  @Column({ type: 'text', name: 'recipient_id' })
  recipientId!: string;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
