import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { OpenAI } from 'openai';
import { firstValueFrom } from 'rxjs';
import { IPriceComparison } from './interfaces/price-comparison.interface';
import { sanitizeInput, isValidProductName } from '../common/utils/security.utils';
import { validatePriceComparison } from '../common/validation/schemas.validation';

@Injectable()
export class PriceComparisonService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(PriceComparisonService.name);
  private readonly MAX_PRODUCT_LENGTH = 100;
  private readonly serpApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not found');
    this.openai = new OpenAI({ apiKey });
    
    this.serpApiKey = this.configService.get<string>('SERPAPI_KEY') || '';
    if (!this.serpApiKey) {
      this.logger.warn('SERPAPI_KEY not configured. Price search will be limited.');
    }
  }

  async getPriceComparison(product: string): Promise<IPriceComparison> {
    const sanitized = sanitizeInput(product, this.MAX_PRODUCT_LENGTH);

    if (!isValidProductName(sanitized)) {
      this.logger.warn(`Invalid product name: "${product.substring(0, 30)}"`);
      return this.emptyPrices(product);
    }

    try {
      this.logger.log(`Searching prices for: ${sanitized}`);
      
      const searchResults = await this.searchWithSerpAPI(sanitized);
      
      if (!searchResults || searchResults.length === 0) {
        this.logger.warn('No web results found');
        return this.emptyPrices(sanitized);
      }

      const pricesData = await this.extractPricesFromResults(sanitized, searchResults);
      
      const validated = validatePriceComparison(pricesData);

      if (!validated || validated.prices.length === 0) {
        this.logger.warn('No prices extracted from results');
        return this.emptyPrices(sanitized);
      }

      this.logger.log(`Found ${validated.prices.length} prices`);
      return this.buildComparison(validated, sanitized);
    } catch (error) {
      this.logger.error(`Prices error: ${error.message}`);
      return this.emptyPrices(sanitized);
    }
  }

  private async searchWithSerpAPI(product: string): Promise<any[]> {
    if (!this.serpApiKey) {
      this.logger.warn('SerpAPI not configured, skipping web search');
      return [];
    }

    try {
      const query = `${product} precio Colombia comprar`;
      const url = 'https://serpapi.com/search';
      
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: {
            q: query,
            location: 'Colombia',
            hl: 'es',
            gl: 'co',
            num: 10,
            api_key: this.serpApiKey,
          },
        })
      );

      const results = response.data?.organic_results || [];
      this.logger.log(`Found ${results.length} web results`);
      
      return results.map((r: any) => ({
        title: r.title,
        url: r.link,
        description: r.snippet,
      }));
    } catch (error) {
      this.logger.error(`SerpAPI error: ${error.message}`);
      return [];
    }
  }

  private async extractPricesFromResults(product: string, results: any[]): Promise<any> {
    const context = results
      .slice(0, 8)
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`)
      .join('\n\n');

    const prompt = `Analiza estos resultados REALES de búsqueda web sobre "${product}" en Colombia.

RESULTADOS:
${context}

TAREA: Extrae SOLO los precios mencionados explícitamente. NO inventes precios.

REGLAS:
1. Solo incluye precios que aparezcan claramente en los resultados
2. Identifica la tienda/sitio de cada precio
3. Si no hay precios claros, devuelve {"product": "${product}", "prices": []}
4. Formatea precios en COP (pesos colombianos) sin decimales

RESPUESTA EN JSON:
{
  "product": "${product}",
  "prices": [
    {"store": "Nombre Tienda", "price": 123000}
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres un extractor de precios. SOLO extraes precios explícitos, NUNCA inventes.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message?.content || '{"prices":[]}';
      const parsed = JSON.parse(content);
      
      this.logger.log(`Extracted prices: ${JSON.stringify(parsed).substring(0, 150)}`);
      return parsed;
    } catch (error) {
      this.logger.error(`OpenAI extraction error: ${error.message}`);
      return { product, prices: [] };
    }
  }

  formatPriceComparisonForPrompt(data: IPriceComparison): string {
    if (data.prices.length === 0) {
      return `Producto: ${data.product}
      
No se encontraron precios en línea para este producto específico.

Sugiere al usuario buscar directamente en tiendas apropiadas según el tipo de producto:
- Mercado Libre Colombia (todo tipo de productos)
- Tiendas especializadas según categoría
- Sitios web oficiales de marcas
- Tiendas físicas locales

Da una recomendación específica basada en QUÉ tipo de producto es.`;
    }

    const list = data.prices
      .sort((a, b) => a.price - b.price)
      .map((p, i) => `${p.store}: $${p.price.toLocaleString('es-CO')}${i === 0 ? ' (Mejor precio)' : ''}`)
      .join('\n');

    const savings = data.average_price - data.best_price;
    return `Producto: ${data.product}

Precios encontrados en Colombia:
${list}

Precio promedio: $${data.average_price.toLocaleString('es-CO')}
Ahorro vs promedio: $${savings.toLocaleString('es-CO')} (${this.savingsPercent(savings, data.average_price)}%)

La mejor opción es ${data.best_store} con $${data.best_price.toLocaleString('es-CO')}`;
  }

  private buildComparison(data: any, product: string): IPriceComparison {
    const valid = data.prices
      .filter((p: any) => p.store && typeof p.price === 'number' && p.price > 0)
      .map((p: any) => ({ store: String(p.store).substring(0, 50), price: Math.round(p.price) }));

    if (valid.length === 0) return this.emptyPrices(product);

    const prices = valid.map((p: any) => p.price);
    const avg = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);
    const best = Math.min(...prices);
    const store = valid.find((p: any) => p.price === best)?.store || '';

    return { product: data.product || product, prices: valid, average_price: avg, best_store: store, best_price: best };
  }

  private emptyPrices(product: string): IPriceComparison {
    return { product, prices: [], average_price: 0, best_store: '', best_price: 0 };
  }

  private savingsPercent(savings: number, avg: number): string {
    return avg === 0 ? '0' : ((savings / avg) * 100).toFixed(1);
  }
}
