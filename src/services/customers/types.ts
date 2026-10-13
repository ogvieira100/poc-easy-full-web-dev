/**
 * DTOs do domínio Customer, espelhando os contratos da API
 * ClaudeNetCoreReactJs.Customers (Models/Customer e Application/Customer).
 */

/**
 * Cliente (Models/Customer + Util.Domain.BaseEntity), no formato
 * camelCase serializado pelo System.Text.Json.
 */
export interface Customer {
    id: number;
    name: string;
    email: string;
    phone: string;
    cpf: string;
    birthDate: string | null;
    active: boolean;
    dateCreated: string;
    dateUpdated: string | null;
    dateDeleted: string | null;
    idUserInserted: number;
    idUserUpdated: number | null;
    idUserDeleted: number | null;
}

/**
 * Payload de criação (Application/Customer/CreateCustomer/CreateCustomerCommand).
 */
export interface CustomerRequest {
    name: string;
    email: string;
    phone: string;
    cpf: string;
    birthDate?: string | null;
}

/**
 * Payload de atualização (UpdateCustomerCommand: herda de CreateCustomerCommand + Id).
 */
export interface UpdateCustomerRequest extends CustomerRequest {
    id: number;
}

/**
 * Resultado do POST /api/Customers (CreateCustomerResult).
 */
export interface CreateCustomerResult {
    id: number;
}

/**
 * Resultado do PUT /api/Customers (UpdateCustomerResult): corpo vazio.
 */
export type UpdateCustomerResult = Record<string, never>;

/**
 * Resultado do DELETE /api/Customers (DeleteCustomerResult): corpo vazio.
 */
export type DeleteCustomerResult = Record<string, never>;
