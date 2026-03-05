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

TAREA: Extrae precios y calificaciones mencionados explícitamente. NO inventes datos.

REGLAS:
1. Solo incluye precios que aparezcan claramente en los resultados
2. Identifica la tienda/sitio de cada precio
3. Si hay calificación/rating/estrellas mencionadas, inclúyela (escala 0-5)
4. Si no hay calificación, omite el campo "rating"
5. Si no hay precios claros, devuelve {"product": "${product}", "prices": []}
6. Formatea precios en COP (pesos colombianos) sin decimales

RESPUESTA EN JSON:
{
  "product": "${product}",
  "prices": [
    {"store": "Nombre Tienda", "price": 123000, "rating": 4.5}
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Eres un extractor de precios y calificaciones. SOLO extraes datos explícitos, NUNCA inventes.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
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
      return `*Producto:* ${data.product}

No encontré precios disponibles en línea para este producto específico. 😕

*Te sugiero buscar en:*
• Mercado Libre Colombia
• Éxito, Falabella, Alkosto
• Tiendas especializadas según el producto
• Sitios web oficiales de la marca`;
    }

    // Lista de precios ordenados
    const priceList = data.prices
      .sort((a, b) => a.price - b.price)
      .map((p, i) => {
        const price = `$${p.price.toLocaleString('es-CO')}`;
        const rating = p.rating ? ` ⭐ ${p.rating.toFixed(1)}` : '';
        const badge = i === 0 ? ' 💰' : '';
        return `• *${p.store}*: ${price}${rating}${badge}`;
      })
      .join('\n');

    // Información de ahorro
    const savings = data.average_price - data.best_price;
    const savingsPercent = this.savingsPercent(savings, data.average_price);
    
    let result = `*📦 Producto:* ${data.product}\n\n`;
    result += `*Precios encontrados en Colombia:*\n${priceList}\n\n`;
    result += `📊 *Precio promedio:* $${data.average_price.toLocaleString('es-CO')}\n`;
    result += `💰 *Ahorro vs promedio:* $${savings.toLocaleString('es-CO')} (${savingsPercent}%)\n\n`;
    result += `👉 *Mejor PRECIO:* ${data.best_store} con $${data.best_price.toLocaleString('es-CO')}`;

    if (data.best_rated_store && data.best_rating) {
      result += `\n\n⭐ *Mejor CALIFICACIÓN:* ${data.best_rated_store} (${data.best_rating.toFixed(1)}/5)`;
    }

    if (data.best_value_store && data.best_value_store !== data.best_store && data.best_value_store !== data.best_rated_store) {
      result += `\n\n🎯 *Mejor RELACIÓN calidad-precio:* ${data.best_value_store}`;
    }

    return result;
  }

  private buildComparison(data: any, product: string): IPriceComparison {
    const valid = data.prices
      .filter((p: any) => p.store && typeof p.price === 'number' && p.price > 0)
      .map((p: any) => ({ 
        store: String(p.store).substring(0, 50), 
        price: Math.round(p.price),
        rating: typeof p.rating === 'number' && p.rating >= 0 && p.rating <= 5 ? p.rating : undefined
      }));

    if (valid.length === 0) return this.emptyPrices(product);

    const prices = valid.map((p: any) => p.price);
    const avg = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);
    const best = Math.min(...prices);
    const store = valid.find((p: any) => p.price === best)?.store || '';

    // Calculate best rated store
    const withRatings = valid.filter((p: any) => p.rating !== undefined);
    let bestRatedStore: string | undefined;
    let bestRating: number | undefined;
    
    if (withRatings.length > 0) {
      const topRated = withRatings.reduce((a: any, b: any) => (b.rating > a.rating ? b : a));
      bestRatedStore = topRated.store;
      bestRating = topRated.rating;
    }

    // Calculate best value store (rating + price balance)
    let bestValueStore: string | undefined;
    
    if (withRatings.length > 1) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;
      
      const scored = withRatings.map((p: any) => {
        const normalizedPrice = priceRange === 0 ? 0 : (p.price - minPrice) / priceRange;
        const valueScore = p.rating * (1 - normalizedPrice * 0.5); // Rating weighted more than price
        return { ...p, valueScore };
      });
      
      const topValue = scored.reduce((a: any, b: any) => (b.valueScore > a.valueScore ? b : a));
      bestValueStore = topValue.store;
    }

    return { 
      product: data.product || product, 
      prices: valid, 
      average_price: avg, 
      best_store: store, 
      best_price: best,
      best_rated_store: bestRatedStore,
      best_rating: bestRating,
      best_value_store: bestValueStore
    };
  }

  private emptyPrices(product: string): IPriceComparison {
    return { product, prices: [], average_price: 0, best_store: '', best_price: 0 };
  }

  private savingsPercent(savings: number, avg: number): string {
    return avg === 0 ? '0' : ((savings / avg) * 100).toFixed(1);
  }
}
