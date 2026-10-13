import type { ApiEnvelope, ProblemDetails } from './types';

/**
 * URL base da API .NET Core.
 * Configurável por ambiente via VITE_API_BASE_URL (ver .env.development).
 * O padrão segue o launchSettings.json do serviço (perfil http).
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5031').replace(/\/+$/, '');

/**
 * Erro tipado da camada de API: carrega o status HTTP e o ProblemDetails
 * retornado pelos handlers de exceção da Util.
 */
export class ApiError extends Error {
    /** Status HTTP (0 quando a conexão com o servidor falhou). */
    readonly status: number;
    /** ProblemDetails da API, quando disponível. */
    readonly problemDetails: ProblemDetails | null;

    constructor(message: string, status: number, problemDetails: ProblemDetails | null = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.problemDetails = problemDetails;
    }
}

function isProblemDetails(body: unknown): body is ProblemDetails {
    return typeof body === 'object' && body !== null && 'title' in body && 'type' in body;
}

function isEnvelope<T>(body: unknown): body is ApiEnvelope<T> {
    return typeof body === 'object' && body !== null && 'success' in body && 'data' in body;
}

/**
 * Monta a URL absoluta de um endpoint da API, para uso fora do fetch
 * (ex.: <img src> apontando para fotos servidas pela API).
 */
export function apiUrl(path: string): string {
    return `${BASE_URL}/${path.replace(/^\/+/, '')}`;
}

function buildUrl(path: string, params?: object): string {
    const url = apiUrl(path);
    if (!params) {
        return url;
    }
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            search.set(key, String(value));
        }
    }
    const query = search.toString();
    return query ? `${url}?${query}` : url;
}

function jsonInit(method: string, body?: unknown): RequestInit {
    return {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    };
}

/**
 * Converte uma resposta HTTP de erro em ApiError, reaproveitando o
 * mesmo contrato do request(): ProblemDetails (RFC 7807) dos handlers
 * da Util ou mensagens em texto puro (BadRequest/Conflict/NotFound
 * da CustomerApi).
 */
async function toApiError(response: Response): Promise<ApiError> {
    let body: unknown = null;
    const text = await response.text();
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            // Corpo não-JSON: mantém o texto bruto.
            body = text;
        }
    }

    // Handlers de exceção da Util respondem ProblemDetails (RFC 7807).
    if (isProblemDetails(body)) {
        return new ApiError(
            body.detail ?? body.title ?? 'Erro retornado pela API.',
            response.status,
            body,
        );
    }

    // Controllers também podem devolver mensagens em texto puro.
    if (typeof body === 'string' && body.trim().length > 0) {
        return new ApiError(body, response.status);
    }

    return new ApiError(`Erro ${response.status} ao chamar a API.`, response.status);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, init);
    } catch {
        throw new ApiError('Falha de conexão com o servidor.', 0);
    }

    if (!response.ok) {
        throw await toApiError(response);
    }

    let body: unknown = null;
    const text = await response.text();
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            // Corpo não-JSON: mantém o texto bruto.
            body = text;
        }
    }

    // Sucesso: desempacota o envelope { success, data } do BaseController.
    if (isEnvelope<T>(body)) {
        if (!body.success) {
            throw new ApiError('A API reportou falha na requisição.', response.status);
        }
        return body.data;
    }

    return body as T;
}

/**
 * GET que devolve o corpo como Blob (ex.: download de PDFs).
 * Erros seguem o mesmo contrato do request() (ApiError).
 */
async function downloadBlob(url: string): Promise<Blob> {
    let response: Response;
    try {
        response = await fetch(url);
    } catch {
        throw new ApiError('Falha de conexão com o servidor.', 0);
    }

    if (!response.ok) {
        throw await toApiError(response);
    }

    return response.blob();
}

/**
 * Dispara no navegador o download de um Blob (âncora temporária com
 * atributo download). O nome do arquivo é definido pelo chamador, pois
 * o Content-Disposition da API não é legível via fetch (o CORS do
 * Program.cs não configura exposed headers).
 */
export function saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

/**
 * Cliente HTTP tipado: desempacota o envelope da API e converte erros
 * em ApiError com o ProblemDetails original.
 */
export const httpClient = {
    get<T>(path: string, params?: object): Promise<T> {
        return request<T>(buildUrl(path, params));
    },
    post<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(buildUrl(path), jsonInit('POST', body));
    },
    /**
     * POST multipart/form-data (ex.: upload de imagens). O Content-Type
     * não é definido manualmente: o navegador inclui o boundary.
     */
    upload<T>(path: string, formData: FormData): Promise<T> {
        return request<T>(buildUrl(path), { method: 'POST', body: formData });
    },
    /**
     * GET devolvendo Blob (ex.: download de nota fiscal em PDF);
     * o download no navegador é disparado com saveBlob.
     */
    download(path: string): Promise<Blob> {
        return downloadBlob(buildUrl(path));
    },
    put<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(buildUrl(path), jsonInit('PUT', body));
    },
    delete<T>(path: string, body?: unknown): Promise<T> {
        return request<T>(buildUrl(path), jsonInit('DELETE', body));
    },
};
