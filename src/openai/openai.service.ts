import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';

@Injectable()
export class OpenaiService {
    private readonly openai: OpenAI;
    private readonly logger = new Logger(OpenaiService.name);       

    constructor() {
        this.openai = new OpenAI({
            apiKey: ConfigService.prototype.get<string>('OPENAI_API_KEY') || '',
        });
    }

    async generateAiResponse(prompt: string): Promise<string> {
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            });
            return response.choices[0].message?.content || '';
        }
        catch (error) {
            this.logger.error('Error generating AI response', error);
            return 'Sorry, something went wrong.';
        }
    }

}
