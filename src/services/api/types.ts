/**
 * Contratos compartilhados da camada de acesso às APIs .NET Core.
 *
 * Os tipos refletem os formatos reais retornados pelos controllers,
 * incluindo o envelope padrão do BaseController (Util.Web) e os
 * contratos de paginação do Util.Domain/Util.Data.
 */

/**
 * Envelope padrão retornado pelo BaseController.ExecControllerAsync.
 */
export interface ApiEnvelope<T> {
    success: boolean;
    data: T;
}

/**
 * ProblemDetails (RFC 7807) retornado pelos handlers de exceção da Util
 * (BadRequestException, BussinessRequestException, NotFoundException etc.).
 */
export interface ProblemDetails {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    traceId?: string;
    errors?: Record<string, string[]>;
}

/**
 * Requisição de paginação (Util.Domain.PagedDataRequest), enviada via query string.
 */
export interface PagedDataRequest {
    /** Número da página (1-based). */
    page?: number;
    /** Quantidade de itens por página. */
    limit?: number;
    /** Coluna usada na ordenação. */
    column?: string;
    /** Ordenação decrescente. */
    desc?: boolean;
    /** Filtro por registro ativo/inativo. */
    active?: boolean;
}

/**
 * Resposta paginada (Util.Domain.PagedDataResponse<T>).
 * Observação: "totalItens" preserva a nomenclatura original da API.
 */
export interface PagedDataResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalItens: number;
    totalPages: number;
}
