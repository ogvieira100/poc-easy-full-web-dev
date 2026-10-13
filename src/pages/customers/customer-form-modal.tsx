import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { customerApi, type CustomerRecord, type SaveCustomerRequest } from '../../services';
import styles from './customers.module.css';

/**
 * Limites e mensagens espelhando a validação do CustomersController
 * da CustomerApi (Validate no POST/PUT).
 */
const MAX_NAME = 150;
const MAX_EMAIL = 150;
const MAX_PHONE = 20;

/**
 * Limites da foto, espelhando o CustomerPhotosController.
 */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type FieldName = 'name' | 'email' | 'phone' | 'cpf' | 'birthDate';

type FieldErrors = Partial<Record<FieldName, string>>;

/**
 * Ação de foto escolhida no formulário: manter, substituir ou remover.
 */
export type PhotoAction =
    | { kind: 'keep' }
    | { kind: 'replace'; file: File }
    | { kind: 'remove' };

interface CustomerFormModalProps {
    /** Cliente em edição; null para criação. */
    customer: CustomerRecord | null;
    /** Requisição de salvar em andamento. */
    submitting: boolean;
    /** Erro devolvido pela API (BadRequest/Conflict). */
    serverError: string | null;
    onClose: () => void;
    onSubmit: (payload: SaveCustomerRequest, photo: PhotoAction) => void;
}

/**
 * Aplica a máscara XXX.XXX.XXX-XX sobre os dígitos do CPF.
 */
function formatCpfInput(digits: string): string {
    const d = digits.replace(/\D/g, '').slice(0, 11);
    let masked = d.slice(0, 3);
    if (d.length > 3) masked += `.${d.slice(3, 6)}`;
    if (d.length > 6) masked += `.${d.slice(6, 9)}`;
    if (d.length > 9) masked += `-${d.slice(9, 11)}`;
    return masked;
}

export default function CustomerFormModal({
    customer,
    submitting,
    serverError,
    onClose,
    onSubmit,
}: CustomerFormModalProps) {
    const [name, setName] = useState(customer?.name ?? '');
    const [email, setEmail] = useState(customer?.email ?? '');
    const [phone, setPhone] = useState(customer?.phone ?? '');
    const [cpf, setCpf] = useState(customer?.cpf ?? '');
    const [birthDate, setBirthDate] = useState(customer?.birthDate?.slice(0, 10) ?? '');
    const [errors, setErrors] = useState<FieldErrors>({});

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [removePhoto, setRemovePhoto] = useState(false);
    const [photoError, setPhotoError] = useState<string | null>(null);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !submitting) {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, submitting]);

    // Revoga a URL de prévia anterior (e a atual ao desmontar).
    useEffect(() => {
        if (!previewUrl) {
            return;
        }
        return () => URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    /** Remove o erro do campo conforme o usuário corrige o valor. */
    const clearError = (field: FieldName) => {
        setErrors(previous => (previous[field] ? { ...previous, [field]: undefined } : previous));
    };

    const handleCpfChange = (value: string) => {
        setCpf(value.replace(/\D/g, '').slice(0, 11));
        clearError('cpf');
    };

    const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        event.target.value = ''; // permite escolher o mesmo arquivo novamente
        if (!file) {
            return;
        }

        if (file.size > MAX_PHOTO_BYTES) {
            setPhotoError('A imagem deve ter no máximo 5 MB.');
            return;
        }
        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
            setPhotoError('Formato de imagem inválido. Use JPEG, PNG, WebP ou GIF.');
            return;
        }

        setPhotoError(null);
        setPhotoFile(file);
        setRemovePhoto(false);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const handleRemovePhoto = () => {
        setPhotoFile(null);
        setRemovePhoto(true);
        setPhotoError(null);
        setPreviewUrl(null);
    };

    const validate = (): FieldErrors => {
        const next: FieldErrors = {};

        const nameTrimmed = name.trim();
        if (!nameTrimmed) {
            next.name = 'O nome é obrigatório.';
        } else if (nameTrimmed.length > MAX_NAME) {
            next.name = `O nome deve ter no máximo ${MAX_NAME} caracteres.`;
        }

        const emailTrimmed = email.trim();
        if (!emailTrimmed) {
            next.email = 'O e-mail é obrigatório.';
        } else if (!emailTrimmed.includes('@') || emailTrimmed.length > MAX_EMAIL) {
            next.email = 'O e-mail é inválido.';
        }

        const phoneTrimmed = phone.trim();
        if (!phoneTrimmed) {
            next.phone = 'O telefone é obrigatório.';
        } else if (phoneTrimmed.length > MAX_PHONE) {
            next.phone = `O telefone deve ter no máximo ${MAX_PHONE} caracteres.`;
        }

        if (cpf.length !== 11) {
            next.cpf = 'O CPF deve conter 11 dígitos numéricos.';
        }

        return next;
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.values(nextErrors).some(Boolean)) {
            return;
        }

        const photo: PhotoAction = photoFile
            ? { kind: 'replace', file: photoFile }
            : removePhoto
              ? { kind: 'remove' }
              : { kind: 'keep' };

        onSubmit(
            {
                name: name.trim(),
                email: email.trim(),
                phone: phone.trim(),
                cpf,
                birthDate: birthDate || null,
            },
            photo,
        );
    };

    const inputClass = (hasError: boolean) =>
        `${styles.input}${hasError ? ` ${styles.inputError}` : ''}`;

    // Foto atual (somente edição), com cache-bust pela última alteração.
    const currentPhotoUrl = customer?.photo
        ? customerApi.getPhotoUrl(customer.id, customer.dateUpdated ?? customer.dateCreated)
        : null;

    const showCurrentPhoto = currentPhotoUrl !== null && !removePhoto && !photoFile;

    return (
        <div className={styles.overlay} onClick={() => { if (!submitting) onClose(); }}>
            <div
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="customer-form-title"
                onClick={event => event.stopPropagation()}
            >
                <header className={styles.dialogHeader}>
                    <h2 className={styles.dialogTitle} id="customer-form-title">
                        {customer ? 'Editar cliente' : 'Novo cliente'}
                    </h2>
                    <button
                        type="button"
                        className={styles.dialogClose}
                        onClick={onClose}
                        disabled={submitting}
                        aria-label="Fechar"
                    >
                        ×
                    </button>
                </header>

                <form onSubmit={handleSubmit} noValidate>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="customer-name">
                            Nome
                        </label>
                        <input
                            id="customer-name"
                            className={inputClass(Boolean(errors.name))}
                            type="text"
                            maxLength={MAX_NAME}
                            value={name}
                            onChange={event => {
                                setName(event.target.value);
                                clearError('name');
                            }}
                            disabled={submitting}
                            autoFocus
                        />
                        {errors.name && <p className={styles.fieldError}>{errors.name}</p>}
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="customer-email">
                            E-mail
                        </label>
                        <input
                            id="customer-email"
                            className={inputClass(Boolean(errors.email))}
                            type="email"
                            maxLength={MAX_EMAIL}
                            value={email}
                            onChange={event => {
                                setEmail(event.target.value);
                                clearError('email');
                            }}
                            disabled={submitting}
                        />
                        {errors.email && <p className={styles.fieldError}>{errors.email}</p>}
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="customer-phone">
                            Telefone
                        </label>
                        <input
                            id="customer-phone"
                            className={inputClass(Boolean(errors.phone))}
                            type="text"
                            maxLength={MAX_PHONE}
                            value={phone}
                            onChange={event => {
                                setPhone(event.target.value);
                                clearError('phone');
                            }}
                            disabled={submitting}
                        />
                        {errors.phone && <p className={styles.fieldError}>{errors.phone}</p>}
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="customer-cpf">
                            CPF
                        </label>
                        <input
                            id="customer-cpf"
                            className={inputClass(Boolean(errors.cpf))}
                            type="text"
                            inputMode="numeric"
                            value={formatCpfInput(cpf)}
                            onChange={event => handleCpfChange(event.target.value)}
                            placeholder="000.000.000-00"
                            disabled={submitting}
                        />
                        {errors.cpf && <p className={styles.fieldError}>{errors.cpf}</p>}
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="customer-birth-date">
                            Data de nascimento <span className={styles.labelOptional}>(opcional)</span>
                        </label>
                        <input
                            id="customer-birth-date"
                            className={styles.input}
                            type="date"
                            value={birthDate}
                            onChange={event => {
                                setBirthDate(event.target.value);
                                clearError('birthDate');
                            }}
                            disabled={submitting}
                        />
                    </div>

                    <div className={styles.field}>
                        <span className={styles.label}>Foto</span>
                        <div className={styles.photoRow}>
                            <div className={styles.photoPreview}>
                                {photoFile && previewUrl ? (
                                    <img src={previewUrl} alt="Prévia da foto" />
                                ) : showCurrentPhoto ? (
                                    <img src={currentPhotoUrl} alt="Foto atual do cliente" />
                                ) : (
                                    <span className={styles.photoPlaceholder}>Sem foto</span>
                                )}
                            </div>
                            <div className={styles.photoControls}>
                                <label className={styles.fileLabel}>
                                    {showCurrentPhoto ? 'Trocar imagem' : 'Escolher imagem'}
                                    <input
                                        type="file"
                                        hidden
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        onChange={handlePhotoChange}
                                        disabled={submitting}
                                    />
                                </label>
                                {showCurrentPhoto && (
                                    <button
                                        type="button"
                                        className={styles.photoRemoveButton}
                                        onClick={handleRemovePhoto}
                                        disabled={submitting}
                                    >
                                        Remover foto
                                    </button>
                                )}
                                {removePhoto && !photoFile && (
                                    <p className={styles.photoHint}>A foto será removida ao salvar.</p>
                                )}
                                <p className={styles.photoHint}>JPEG, PNG, WebP ou GIF — até 5 MB.</p>
                            </div>
                        </div>
                        {photoError && <p className={styles.fieldError}>{photoError}</p>}
                    </div>

                    {serverError && (
                        <p className={styles.formError} role="alert">
                            {serverError}
                        </p>
                    )}

                    <footer className={styles.formActions}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className={styles.primaryButton} disabled={submitting}>
                            {submitting ? 'Salvando…' : customer ? 'Salvar alterações' : 'Cadastrar'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
}
