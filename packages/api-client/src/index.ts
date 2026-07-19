import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './generated/schema';

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Typed Tutorio API client generated from the OpenAPI schema.
 * `pnpm generate` refreshes the schema (openapi.json → src/generated/schema.ts).
 */
export function createApiClient(options: ClientOptions & { baseUrl: string }) {
  return createClient<paths>(options);
}

export type { paths };
