/**
 * DTOs do domínio Customer, espelhando os contratos da CustomerApi
 * (rota base: /api/customers — Entities/Customer + BaseEntity).
 *
 * Diferente da API ClaudeNetCoreReactJs.Customers, esta API devolve
 * coleções simples (sem o envelope { success, data } do BaseController)
 * e erros em texto puro (BadRequest/Conflict com mensagem).
 */

/**
 * Cliente (Entities/Customer + BaseEntity), no formato camelCase
 * serializado pelo System.Text.Json.
 */
export interface CustomerRecord {
    id: number;
    name: string;
    email: string;
    phone: string;
    cpf: string;
    birthDate: string | null;
    /** Nome do blob da foto no Azure Storage (ex.: "customers/42"). */
    photo: string | null;
    /** Nome do blob da nota fiscal no Azure Storage (ex.: "notas-fiscais/42"). */
    notaFiscal: string | null;
    active: boolean;
    dateCreated: string;
    dateUpdated: string | null;
    dateDeleted: string | null;
    idUserInserted: number;
    idUserUpdated: number | null;
    idUserDeleted: number | null;
}

/**
 * Payload de criação e atualização (POST /api/customers e
 * PUT /api/customers/{id}).
 */
export interface SaveCustomerRequest {
    name: string;
    email: string;
    phone: string;
    cpf: string;
    birthDate?: string | null;
}

/**
 * Envelope devolvido pelo GET /api/customers quando useCache=true
 * (record CustomersCachedResponse da CustomerApi).
 */
export interface CustomersCachedResponse {
    customers: CustomerRecord[];
    /** true quando a listagem veio do Redis; false quando foi lida do banco e gravada no cache. */
    fromCache: boolean;
    /** Instante (ISO 8601, UTC) em que a entrada do Redis expira (TTL de 1 minuto). */
    cacheExpiresAt: string;
}

/**
 * Metadados do cache Redis, usados pelo contador regressivo na tela.
 */
export interface CustomersCacheMetadata {
    fromCache: boolean;
    cacheExpiresAt: string;
}

/**
 * Resultado normalizado da listagem de clientes: a lista e, quando a
 * consulta passou pelo cache Redis, os metadados do cache (null na
 * consulta direta).
 */
export interface GetAllCustomersResult {
    customers: CustomerRecord[];
    cache: CustomersCacheMetadata | null;
}
