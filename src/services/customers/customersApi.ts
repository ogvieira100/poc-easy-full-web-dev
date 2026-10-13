import { httpClient } from '../api';
import type { PagedDataRequest, PagedDataResponse } from '../api';
import type {
    CreateCustomerResult,
    Customer,
    CustomerRequest,
    DeleteCustomerResult,
    UpdateCustomerRequest,
    UpdateCustomerResult,
} from './types';

/**
 * Acesso tipado ao controller CustomersController da API
 * ClaudeNetCoreReactJs.Customers (rota base: /api/Customers).
 */
const BASE_PATH = '/api/Customers';

export const customersApi = {
    /**
     * GET /api/Customers — lista paginada de clientes.
     * @param request Paginação e ordenação (PagedDataRequest).
     */
    getAll(request?: PagedDataRequest): Promise<PagedDataResponse<Customer>> {
        return httpClient.get<PagedDataResponse<Customer>>(BASE_PATH, request);
    },

    /**
     * GET /api/Customers/{id} — cliente por chave.
     */
    getById(id: number): Promise<Customer> {
        return httpClient.get<Customer>(`${BASE_PATH}/${id}`);
    },

    /**
     * POST /api/Customers — cria um cliente.
     */
    create(payload: CustomerRequest): Promise<CreateCustomerResult> {
        return httpClient.post<CreateCustomerResult>(BASE_PATH, payload);
    },

    /**
     * PUT /api/Customers — atualiza um cliente.
     */
    update(payload: UpdateCustomerRequest): Promise<UpdateCustomerResult> {
        return httpClient.put<UpdateCustomerResult>(BASE_PATH, payload);
    },

    /**
     * DELETE /api/Customers — exclusão lógica (recebe { id } no corpo).
     */
    delete(id: number): Promise<DeleteCustomerResult> {
        return httpClient.delete<DeleteCustomerResult>(BASE_PATH, { id });
    },

    /**
     * GET /api/Customers/GetGuid — GUID aleatório gerado pelo servidor.
     */
    getGuid(): Promise<string> {
        return httpClient.get<string>(`${BASE_PATH}/GetGuid`);
    },
};
