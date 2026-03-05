import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  user_phone: string;

  @Column({ type: 'text', nullable: false })
  message: string;

  @Column({ type: 'varchar', length: 20, nullable: false, default: 'other' })
  intent: 'purchase_advice' | 'farewell' | 'other';

  @Column({ type: 'varchar', length: 255, nullable: true })
  product?: string;

  @Column({ type: 'text', nullable: false })
  bot_response: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
