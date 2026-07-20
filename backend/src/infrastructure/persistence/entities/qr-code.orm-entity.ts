import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'qr_codes' })
@Index(['userId', 'createdAt'])
export class QrCodeOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text', name: 'content_type' })
  contentType!: 'url' | 'text' | 'wifi' | 'email' | 'vcard';

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

  @Column({ type: 'text', name: 'encoded_content', nullable: true })
  encodedContent!: string | null;

  @Column({ type: 'boolean', name: 'has_logo', default: false })
  hasLogo!: boolean;

  @Column({ type: 'text', name: 'logo_mime_type', nullable: true })
  logoMimeType!: string | null;

  @Column({ type: 'text', nullable: true })
  source!: 'qr' | 'shortlink' | null;

  @Column({ type: 'datetime', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
