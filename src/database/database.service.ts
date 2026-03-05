import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectRepository(Conversation) private conversationRepository: Repository<Conversation>) {}

  async saveConversation(data: {
    user_phone: string;
    message: string;
    intent: 'purchase_advice' | 'farewell' | 'other';
    product?: string;
    bot_response: string;
  }): Promise<string | null> {
    try {
      const conversation = this.conversationRepository.create(data);
      const saved = await this.conversationRepository.save(conversation);
      this.logger.log(`Conversation saved: ${saved.id}`);
      return saved.id;
    } catch (error) {
      this.logger.error(`Save error: ${error.message}`);
      return null;
    }
  }

  async getUserConversations(userPhone: string, limit = 10): Promise<Conversation[]> {
    try {
      return await this.conversationRepository.find({
        where: { user_phone: userPhone },
        order: { created_at: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Fetch error: ${error.message}`);
      return [];
    }
  }

  async getStats(): Promise<{ totalConversations: number; totalUsers: number; purchaseIntents: number } | null> {
    try {
      const totalConversations = await this.conversationRepository.count();
      const uniqueUsers = await this.conversationRepository
        .createQueryBuilder('conversation')
        .select('DISTINCT conversation.user_phone')
        .getRawMany();
      const purchaseIntents = await this.conversationRepository.count({ where: { intent: 'purchase_advice' } });

      return { totalConversations, totalUsers: uniqueUsers.length, purchaseIntents };
    } catch (error) {
      this.logger.error(`Stats error: ${error.message}`);
      return null;
    }
  }
}
