import { useEffect } from 'react';
import type { CustomerRecord } from '../../services';
import { formatCpf } from './formatters';
import styles from './customers.module.css';

interface ConfirmDeleteModalProps {
    customer: CustomerRecord;
    /** Requisição de excluir em andamento. */
    deleting: boolean;
    /** Erro devolvido pela API. */
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function ConfirmDeleteModal({
    customer,
    deleting,
    error,
    onCancel,
    onConfirm,
}: ConfirmDeleteModalProps) {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !deleting) {
                onCancel();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onCancel, deleting]);

    return (
        <div className={styles.overlay} onClick={() => { if (!deleting) onCancel(); }}>
            <div
                className={`${styles.dialog} ${styles.dialogNarrow}`}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-customer-title"
                aria-describedby="delete-customer-text"
                onClick={event => event.stopPropagation()}
            >
                <h2 className={styles.dialogTitle} id="delete-customer-title">
                    Excluir cliente
                </h2>
                <p className={styles.dialogText} id="delete-customer-text">
                    Tem certeza de que deseja excluir <strong>{customer.name}</strong> (CPF{' '}
                    {formatCpf(customer.cpf)})? O registro será marcado como inativo.
                </p>

                {error && (
                    <p className={styles.formError} role="alert">
                        {error}
                    </p>
                )}

                <footer className={styles.formActions}>
                    <button
                        type="button"
                        className={styles.cancelButton}
                        onClick={onCancel}
                        disabled={deleting}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={onConfirm}
                        disabled={deleting}
                    >
                        {deleting ? 'Excluindo…' : 'Excluir'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
