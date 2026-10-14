import { httpClient, apiUrl } from '../api';
import type {
    CustomerRecord,
    CustomersCachedResponse,
    GetAllCustomersResult,
    SaveCustomerRequest,
} from './types';

/**
 * Acesso tipado ao controller CustomersController da CustomerApi
 * (rota base: /api/customers).
 *
 * O controller devolve coleções simples — sem o envelope
 * { success, data } do BaseController e sem paginação no servidor.
 * Quando useCache=true, devolve o envelope CustomersCachedResponse
 * (clientes + metadados do cache Redis).
 */
const BASE_PATH = '/api/customers';

export const customerApi = {
    /**
     * GET /api/customers — lista completa de clientes (apenas ativos,
     * pois o soft-delete usa query filter no EF Core).
     *
     * Com useCache=true a consulta passa pelo cache Redis (TTL de 1 minuto)
     * e o resultado traz metadados do cache (origem e expiração) para o
     * contador regressivo exibido na tela. Sem cache, cache fica null.
     */
    getAll(useCache = false): Promise<GetAllCustomersResult> {
        return httpClient
            .get<CustomerRecord[] | CustomersCachedResponse>(
                BASE_PATH,
                useCache ? { useCache: true } : undefined,
            )
            .then(body =>
                Array.isArray(body)
                    ? { customers: body, cache: null }
                    : {
                          customers: body.customers,
                          cache: { fromCache: body.fromCache, cacheExpiresAt: body.cacheExpiresAt },
                      },
            );
    },

    /**
     * GET /api/customers/{id} — cliente por chave (404 se não existir).
     */
    getById(id: number): Promise<CustomerRecord> {
        return httpClient.get<CustomerRecord>(`${BASE_PATH}/${id}`);
    },

    /**
     * GET /api/customers/new-guid — GUID aleatório gerado pelo servidor.
     */
    newGuid(): Promise<string> {
        return httpClient.get<string>(`${BASE_PATH}/new-guid`);
    },

    /**
     * POST /api/customers — cria um cliente
     * (400 com mensagem se os dados forem inválidos; 409 se o CPF já existir).
     */
    create(payload: SaveCustomerRequest): Promise<CustomerRecord> {
        return httpClient.post<CustomerRecord>(BASE_PATH, payload);
    },

    /**
     * PUT /api/customers/{id} — atualiza um cliente.
     */
    update(id: number, payload: SaveCustomerRequest): Promise<CustomerRecord> {
        return httpClient.put<CustomerRecord>(`${BASE_PATH}/${id}`, payload);
    },

    /**
     * DELETE /api/customers/{id} — exclusão lógica (soft-delete);
     * responde 204 No Content.
     */
    delete(id: number): Promise<void> {
        return httpClient.delete<void>(`${BASE_PATH}/${id}`);
    },

    /**
     * POST /api/customers/{id}/photo — envia a foto do cliente
     * (multipart/form-data, campo "file"). Substitui a foto anterior.
     */
    uploadPhoto(id: number, file: File): Promise<CustomerRecord> {
        const formData = new FormData();
        formData.append('file', file);
        return httpClient.upload<CustomerRecord>(`${BASE_PATH}/${id}/photo`, formData);
    },

    /**
     * DELETE /api/customers/{id}/photo — remove a foto do cliente.
     */
    deletePhoto(id: number): Promise<void> {
        return httpClient.delete<void>(`${BASE_PATH}/${id}/photo`);
    },

    /**
     * URL de exibição da foto (GET /api/customers/{id}/photo), para uso
     * em <img src>. O parâmetro version evita cache do navegador após
     * trocar a imagem.
     */
    getPhotoUrl(id: number, version?: string | null): string {
        const url = apiUrl(`${BASE_PATH}/${id}/photo`);
        return version ? `${url}?v=${encodeURIComponent(version)}` : url;
    },

    /**
     * POST /api/customers/{id}/nota-fiscal — envia a nota fiscal do cliente
     * (multipart/form-data, campo "file", PDF). Substitui a nota anterior.
     */
    uploadNota(id: number, file: File): Promise<CustomerRecord> {
        const formData = new FormData();
        formData.append('file', file);
        return httpClient.upload<CustomerRecord>(`${BASE_PATH}/${id}/nota-fiscal`, formData);
    },

    /**
     * GET /api/customers/{id}/nota-fiscal — baixa a nota fiscal (PDF) como
     * Blob; o download no navegador é disparado com saveBlob.
     */
    downloadNota(id: number): Promise<Blob> {
        return httpClient.download(`${BASE_PATH}/${id}/nota-fiscal`);
    },
};
