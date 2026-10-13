/**
 * Formatadores compartilhados da página de clientes.
 */

/**
 * Formata um CPF armazenado como 11 dígitos (XXX.XXX.XXX-XX).
 * Valores em outros formatos são devolvidos sem alteração.
 */
export function formatCpf(cpf: string): string {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) {
        return cpf;
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Formata uma data ISO 8601 (System.Text.Json) como dd/MM/aaaa usando a
 * parte da data em UTC, evitando deslocamento de fuso no cliente.
 */
export function formatDate(value: string | null): string {
    if (!value) {
        return '—';
    }
    const datePart = value.slice(0, 10); // yyyy-MM-dd
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return value;
    }
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
}
