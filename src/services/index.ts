/**
 * Camada de acesso aos serviços .NET Core API.
 *
 * Estrutura:
 * - api/          — cliente HTTP tipado, envelope e contratos compartilhados.
 * - customers/    — serviço e DTOs do controller Customers da API
 *                   ClaudeNetCoreReactJs.Customers (uma pasta por API).
 * - customerApi/  — serviço e DTOs da CustomerApi (rota /api/customers).
 *
 * Uso:
 *   import { customersApi, customerApi, ApiError } from '../services';
 */
export * from './api';
export * from './customers';
export * from './customerApi';
