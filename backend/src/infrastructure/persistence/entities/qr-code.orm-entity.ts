import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'qr_codes' })
@Index(['userId', 'createdAt'])
export class QrCodeOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text', name: 'content_type' })
  contentType!: 'url' | 'text';

  @Column('text')
  content!: string;

  @Column('integer')
  size!: number;

  @Column({ type: 'text', name: 'fg_color' })
  fgColor!: string;

  @Column({ type: 'text', name: 'bg_color' })
  bgColor!: string;

  @Column({ type: 'text', name: 'error_correction' })
  errorCorrection!: 'L' | 'M' | 'Q' | 'H';

  @Column({ type: 'integer', name: 'scan_count', default: 0 })
  scanCount!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
