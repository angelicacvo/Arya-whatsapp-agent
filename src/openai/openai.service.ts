import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { IUserIntent } from './interfaces/user-intent.interface';
import { PriceComparisonService } from '../price-comparison/price-comparison.service';
import { detectMaliciousInput, sanitizeInput } from '../common/utils/security.utils';
import { validateUserIntent } from '../common/validation/schemas.validation';

@Injectable()
export class OpenaiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenaiService.name);
  private readonly MAX_INPUT_LENGTH = 200;

  constructor(
    private readonly configService: ConfigService,
    private readonly priceComparisonService: PriceComparisonService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not found');
    this.openai = new OpenAI({ apiKey });
  }

  async analyzeUserIntent(userMessage: string): Promise<IUserIntent> {
    if (detectMaliciousInput(userMessage)) {
      this.logger.warn(`🚨 Malicious: "${userMessage.substring(0, 50)}"`);
      return { intent: 'other', product: null };
    }

    const sanitized = sanitizeInput(userMessage, this.MAX_INPUT_LENGTH);
    if (!sanitized || sanitized.length < 2) return { intent: 'other', product: null };

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: this.getIntentPrompt() },
          { role: 'user', content: sanitized },
        ],
        temperature: 0.2,
        max_tokens: 80,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message?.content || '{"intent":"other","product":null}';
      const parsed = JSON.parse(content);
      const validated = validateUserIntent(parsed);

      if (!validated) {
        this.logger.error('Invalid intent', parsed);
        return { intent: 'other', product: null };
      }

      this.logger.log(`📊 ${validated.intent}, ${validated.product || 'none'}`);
      return validated;
    } catch (error) {
      this.logger.error(`Intent error: ${error}`);
      return { intent: 'other', product: null };
    }
  }

  private getIntentPrompt(): string {
    return `Classify intent. JSON only.
{"intent":"purchase_advice"|"other","product":"name"|null}
Rules: purchase_advice=prices/buying, other=greetings/chat
Examples: "¿iPhone?" → {"intent":"purchase_advice","product":"iphone"}`;
  }

  async generatePurchaseAdvice(product: string): Promise<string> {
    const validated = sanitizeInput(product, 100);
    this.logger.log(`🛍️ Advice for: ${validated}`);

    try {
      const messages: any[] = [
        { role: 'system', content: this.getAdvisorPrompt() },
        { role: 'user', content: `Producto: ${validated}` },
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: this.getTool() as any,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 400,
      });

      const msg = response.choices[0].message;
      if (msg.tool_calls) return await this.handleToolCalls(msg, messages, validated);
      return msg.content || 'No pude generar recomendación.';
    } catch (error) {
      this.logger.error(`Advice error: ${error}`);
      return 'Error al generar recomendación.';
    }
  }

  private async handleToolCalls(msg: any, messages: any[], product: string): Promise<string> {
    messages.push(msg);

    for (const call of msg.tool_calls) {
      if (call.type === 'function' && call.function.name === 'get_price_comparison') {
        const args = JSON.parse(call.function.arguments);
        const data = await this.priceComparisonService.getPriceComparison(args.product || product);
        const formatted = this.priceComparisonService.formatPriceComparisonForPrompt(data);

        messages.push({
          tool_call_id: call.id,
          role: 'tool',
          name: call.function.name,
          content: formatted,
        });
      }
    }

    const final = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 400,
    });

    return final.choices[0].message?.content || 'No pude generar recomendación.';
  }

  private getAdvisorPrompt(): string {
    return `Eres Arya, asistente de compras en Colombia. Responde SOLO en español.

Tu trabajo:
1) Saluda amigablemente
2) Muestra los precios encontrados en diferentes tiendas colombianas
3) Recomienda la mejor opción (menor precio)
4) Si NO hay precios disponibles, sugiere al usuario buscar directamente en: Mercado Libre Colombia, Éxito, Falabella, o tiendas especializadas según el producto
5) Da un consejo breve y útil
6) Termina con "¿Necesitas consultar algo más?"

Tono: Amigable, conciso, honesto. Si no hay datos, sé transparente y sugiere alternativas.`;
  }

  private getTool(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_price_comparison',
          description: 'Get prices from Colombian stores',
          parameters: {
            type: 'object',
            properties: { product: { type: 'string', description: 'Product name' } },
            required: ['product'],
          },
        },
      },
    ];
  }
}
