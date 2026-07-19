import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './generated/schema';

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Типизированный клиент Tutorio API, сгенерированный из OpenAPI-схемы.
 * `pnpm generate` обновляет схему (openapi.json → src/generated/schema.ts).
 */
export function createApiClient(options: ClientOptions & { baseUrl: string }) {
  return createClient<paths>(options);
}

export type { paths };
