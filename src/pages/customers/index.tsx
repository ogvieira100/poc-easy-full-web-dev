import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
    ApiError,
    customerApi,
    saveBlob,
    type CustomerRecord,
    type CustomersCacheMetadata,
    type SaveCustomerRequest,
} from '../../services';
import { formatCpf, formatDate } from './formatters';
import ConfirmDeleteModal from './confirm-delete-modal';
import CustomerFormModal, { type PhotoAction } from './customer-form-modal';
import styles from './customers.module.css';

/**
 * Número de itens exibidos por página (paginação no cliente).
 */
const PAGE_SIZE = 10;

type SortKey = 'name' | 'birthDate' | 'dateCreated';

/**
 * Estado do modal de criação/edição de cliente.
 */
type FormModalState =
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; customer: CustomerRecord };

/**
 * Iniciais (até duas) exibidas no avatar do cliente.
 */
function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('');
}

/**
 * Matiz (hue) determinístico por nome, usado na cor do avatar.
 */
function avatarHue(name: string): number {
    let hash = 0;
    for (const char of name) {
        hash = (hash * 31 + char.charCodeAt(0)) % 360;
    }
    return hash;
}

/**
 * Indicador de ordenação dos cabeçalhos clicáveis.
 */
function SortIndicator({ active, desc }: { active: boolean; desc: boolean }) {
    const stateClass = active ? (desc ? styles.sortDesc : styles.sortAsc) : '';
    return (
        <svg
            className={`${styles.sortIcon} ${stateClass}`}
            width="10"
            height="14"
            viewBox="0 0 10 14"
            aria-hidden="true"
        >
            <path className={styles.sortArrowUp} d="M5 0 L9 6 H1 Z" />
            <path className={styles.sortArrowDown} d="M5 14 L1 8 H9 Z" />
        </svg>
    );
}

/**
 * Linhas esqueleto exibidas enquanto a API não responde.
 */
function SkeletonRows() {
    const widths = ['45%', '55%', '38%', '34%', '32%', '30%', '24%'];
    return (
        <div className={styles.card}>
            <div className={styles.tableWrap}>
                <table className={styles.table} aria-hidden="true">
                    <tbody>
                        {Array.from({ length: 6 }, (_, row) => (
                            <tr key={row}>
                                {widths.map((width, column) => (
                                    <td key={column}>
                                        <div className={styles.skeletonBlock} style={{ width }} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function Customers() {
    const [customers, setCustomers] = useState<CustomerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDesc, setSortDesc] = useState(false);
    const [page, setPage] = useState(1);

    const [useCache, setUseCache] = useState(false);
    const [cacheInfo, setCacheInfo] = useState<CustomersCacheMetadata | null>(null);
    const [now, setNow] = useState(() => Date.now());

    // Espelho do checkbox para a consulta: o efeito abaixo mantém o valor
    // atualizado para que a consulta leia o estado mais recente sem precisar
    // re-executar quando o checkbox é marcado/desmarcado (quem dispara a
    // consulta é o botão "Consultar"/reload).
    const useCacheRef = useRef(useCache);

    useEffect(() => {
        useCacheRef.current = useCache;
    });

    const [formModal, setFormModal] = useState<FormModalState>({ mode: 'closed' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);

    const [notaTargetId, setNotaTargetId] = useState<number | null>(null);
    const [notaBusyId, setNotaBusyId] = useState<number | null>(null);
    const [notaError, setNotaError] = useState<string | null>(null);
    const notaFileInput = useRef<HTMLInputElement>(null);

    const [guid, setGuid] = useState<string | null>(null);
    const [guidLoading, setGuidLoading] = useState(false);
    const [guidError, setGuidError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        // O botão "Consultar" (e o reload após mutações) é quem dispara a
        // consulta; o checkbox apenas define se ela passa pelo cache Redis.
        customerApi
            .getAll(useCacheRef.current)
            .then(result => {
                if (cancelled) {
                    return;
                }
                setCustomers(result.customers);
                setCacheInfo(result.cache);
                setPage(1);
            })
            .catch((reason: unknown) => {
                if (cancelled) {
                    return;
                }
                setError(
                    reason instanceof ApiError ? reason.message : 'Falha ao carregar os clientes.',
                );
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    // Contador regressivo do TTL do cache Redis, atualizado a cada segundo.
    useEffect(() => {
        if (!cacheInfo) {
            return;
        }
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [cacheInfo]);

    const cacheRemainingSeconds = cacheInfo
        ? Math.max(0, Math.ceil((new Date(cacheInfo.cacheExpiresAt).getTime() - now) / 1000))
        : 0;

    // Filtra e ordena localmente: o controller devolve a lista completa.
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        const list = customers.filter(customer => {
            if (!term) {
                return true;
            }
            return (
                customer.name.toLowerCase().includes(term) ||
                customer.email.toLowerCase().includes(term) ||
                customer.cpf.includes(term) ||
                formatCpf(customer.cpf).includes(term)
            );
        });

        const compare = (a: CustomerRecord, b: CustomerRecord): number => {
            const leftText = a[sortKey] == null ? '' : String(a[sortKey]);
            const rightText = b[sortKey] == null ? '' : String(b[sortKey]);
            return leftText.localeCompare(rightText, 'pt-BR', { numeric: true });
        };

        return list.toSorted((a, b) => (sortDesc ? -compare(a, b) : compare(a, b)));
    }, [customers, search, sortKey, sortDesc]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(1);
    };

    const reload = () => {
        setLoading(true);
        setError(null);
        setReloadKey(key => key + 1);
    };

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = useMemo(
        () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
        [filtered, currentPage],
    );
    const firstItem = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const lastItem = Math.min(currentPage * PAGE_SIZE, filtered.length);

    // Janela de páginas (1 … atual±1 … última).
    const pages = useMemo(() => {
        const range: (number | 'gap')[] = [];
        const windowStart = Math.max(2, currentPage - 1);
        const windowEnd = Math.min(totalPages - 1, currentPage + 1);

        range.push(1);
        if (windowStart > 2) {
            range.push('gap');
        }
        for (let number = windowStart; number <= windowEnd; number++) {
            range.push(number);
        }
        if (windowEnd < totalPages - 1) {
            range.push('gap');
        }
        if (totalPages > 1) {
            range.push(totalPages);
        }
        return range;
    }, [currentPage, totalPages]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDesc(prev => !prev);
        } else {
            setSortKey(key);
            setSortDesc(false);
        }
        setPage(1);
    };

    const clearSearch = () => {
        setSearch('');
        setPage(1);
    };

    // ── CRUD ──────────────────────────────────────────────────────────

    const openCreate = () => {
        setSaveError(null);
        setFormModal({ mode: 'create' });
    };

    const openEdit = (customer: CustomerRecord) => {
        setSaveError(null);
        setFormModal({ mode: 'edit', customer });
    };

    const closeForm = () => {
        if (!saving) {
            setFormModal({ mode: 'closed' });
        }
    };

    /**
     * Sobe a foto do cliente após criar/atualizar. Se o upload falhar,
     * devolve um aviso para o feedback (o cadastro em si já foi salvo).
     */
    const savePhoto = async (customerId: number, file: File): Promise<string> => {
        try {
            await customerApi.uploadPhoto(customerId, file);
            return '';
        } catch {
            return ' A foto não pôde ser enviada — edite o cliente para tentar novamente.';
        }
    };

    const handleSave = async (payload: SaveCustomerRequest, photo: PhotoAction) => {
        if (formModal.mode === 'closed') {
            return;
        }
        setSaving(true);
        setSaveError(null);
        try {
            let photoWarning = '';
            if (formModal.mode === 'create') {
                const created = await customerApi.create(payload);
                if (photo.kind === 'replace') {
                    photoWarning = await savePhoto(created.id, photo.file);
                }
                setFeedback(`Cliente "${payload.name}" cadastrado com sucesso.${photoWarning}`);
            } else {
                const id = formModal.customer.id;
                await customerApi.update(id, payload);
                if (photo.kind === 'replace') {
                    photoWarning = await savePhoto(id, photo.file);
                } else if (photo.kind === 'remove') {
                    try {
                        await customerApi.deletePhoto(id);
                    } catch {
                        photoWarning = ' A foto não pôde ser removida.';
                    }
                }
                setFeedback(`Cliente "${payload.name}" atualizado com sucesso.${photoWarning}`);
            }
            setFormModal({ mode: 'closed' });
            reload();
        } catch (reason: unknown) {
            setSaveError(reason instanceof ApiError ? reason.message : 'Falha ao salvar o cliente.');
        } finally {
            setSaving(false);
        }
    };

    const openDelete = (customer: CustomerRecord) => {
        setDeleteError(null);
        setDeleteTarget(customer);
    };

    const closeDelete = () => {
        if (!deleting) {
            setDeleteTarget(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) {
            return;
        }
        setDeleting(true);
        setDeleteError(null);
        try {
            await customerApi.delete(deleteTarget.id);
            setFeedback(`Cliente "${deleteTarget.name}" excluído.`);
            setDeleteTarget(null);
            reload();
        } catch (reason: unknown) {
            setDeleteError(
                reason instanceof ApiError ? reason.message : 'Falha ao excluir o cliente.',
            );
        } finally {
            setDeleting(false);
        }
    };

    // ── Nota fiscal ──────────────────────────────────────────────────

    const openNotaPicker = (customer: CustomerRecord) => {
        setNotaTargetId(customer.id);
        notaFileInput.current?.click();
    };

    const handleNotaFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const file = input.files?.[0] ?? null;
        const customerId = notaTargetId;

        // Zera o input para permitir escolher o mesmo arquivo novamente.
        input.value = '';
        setNotaTargetId(null);

        if (!file || customerId === null) {
            return;
        }

        const customer = customers.find(item => item.id === customerId);
        setNotaBusyId(customerId);
        setNotaError(null);
        try {
            await customerApi.uploadNota(customerId, file);
            setFeedback(`Nota fiscal de "${customer?.name ?? 'cliente'}" enviada com sucesso.`);
            reload();
        } catch (reason: unknown) {
            setNotaError(
                reason instanceof ApiError ? reason.message : 'Falha ao enviar a nota fiscal.',
            );
        } finally {
            setNotaBusyId(null);
        }
    };

    const handleDownloadNota = async (customer: CustomerRecord) => {
        setNotaBusyId(customer.id);
        setNotaError(null);
        try {
            const blob = await customerApi.downloadNota(customer.id);
            saveBlob(blob, `nota-fiscal-${customer.id}.pdf`);
        } catch (reason: unknown) {
            setNotaError(
                reason instanceof ApiError ? reason.message : 'Falha ao baixar a nota fiscal.',
            );
        } finally {
            setNotaBusyId(null);
        }
    };

    // ── GUID ──────────────────────────────────────────────────────────

    /**
     * Pede um GUID aleatório ao servidor e o exibe na caixa de texto.
     */
    const handleGenerateGuid = async () => {
        setGuidLoading(true);
        setGuidError(null);
        try {
            setGuid(await customerApi.newGuid());
        } catch (reason: unknown) {
            setGuidError(
                reason instanceof ApiError ? reason.message : 'Falha ao gerar o GUID.',
            );
        } finally {
            setGuidLoading(false);
        }
    };

    const sortableColumns: { key: SortKey; label: string }[] = [
        { key: 'name', label: 'Cliente' },
        { key: 'birthDate', label: 'Nascimento' },
        { key: 'dateCreated', label: 'Cadastro' },
    ];

    const sortStateOf = (key: SortKey) => ({
        active: sortKey === key,
        desc: sortKey === key && sortDesc,
    });

    return (
        <section className={styles.page} aria-busy={loading}>
            <header className={styles.toolbar}>
                <div className={styles.titleRow}>
                    <h1 className={styles.heading}>Clientes</h1>
                    {!loading && !error && (
                        <span className={styles.count} title={`${customers.length} registros`}>
                            {customers.length}
                        </span>
                    )}
                </div>

                <div className={styles.controls}>
                    <label className={styles.search}>
                        <svg
                            className={styles.searchIcon}
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                        >
                            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                            <path
                                d="M10.5 10.5 L14 14"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                            />
                        </svg>
                        <input
                            type="search"
                            className={styles.searchInput}
                            placeholder="Buscar por nome, e-mail ou CPF"
                            value={search}
                            onChange={event => handleSearchChange(event.target.value)}
                            aria-label="Buscar clientes"
                        />
                    </label>

                    <label
                        className={styles.cacheToggle}
                        title="Marca para as consultas usarem o cache Redis (TTL de 1 minuto)"
                    >
                        <input
                            type="checkbox"
                            checked={useCache}
                            onChange={event => {
                                const checked = event.target.checked;
                                setUseCache(checked);
                                if (!checked) {
                                    // Sem cache selecionado, o status do
                                    // Redis deixa de fazer sentido na tela.
                                    setCacheInfo(null);
                                }
                            }}
                        />
                        <span>Usar cache Redis</span>
                    </label>

                    <button
                        type="button"
                        className={styles.queryButton}
                        onClick={reload}
                        title={
                            useCache
                                ? 'Consulta a lista pelo cache Redis; se o cache estiver expirado, busca da base e regrava'
                                : 'Consulta a lista direto da base'
                        }
                    >
                        Consultar
                    </button>

                    <button
                        type="button"
                        className={styles.queryButton}
                        onClick={handleGenerateGuid}
                        disabled={guidLoading}
                        title="Gera um GUID aleatório no servidor e exibe o valor"
                    >
                        {guidLoading ? 'Gerando…' : 'Gerar GUID'}
                    </button>

                    <button type="button" className={styles.newButton} onClick={openCreate}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                                d="M12 5v14M5 12h14"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                            />
                        </svg>
                        Novo cliente
                    </button>

                    <button
                        type="button"
                        className={`${styles.refresh} ${loading ? styles.refreshSpinning : ''}`}
                        onClick={reload}
                        title="Atualizar"
                        aria-label="Atualizar lista de clientes"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                                d="M12.9 9.3a5.5 5.5 0 1 1-1.36-5.66l2.86 2.61"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M14.4 2.5v3.75h-3.75"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>
            </header>

            {useCache && cacheInfo && (
                <div className={styles.cacheStatus}>
                    <span
                        className={`${styles.cacheBadge} ${
                            cacheInfo.fromCache ? styles.cacheHit : styles.cacheMiss
                        }`}
                    >
                        <span className={styles.cacheDot} />
                        {cacheInfo.fromCache
                            ? 'HIT — servido do Redis'
                            : 'MISS — lido do banco e gravado no Redis'}
                    </span>
                    <span className={styles.cacheTime}>
                        {cacheRemainingSeconds > 0
                            ? `Cache expira em ${cacheRemainingSeconds}s`
                            : 'Cache expirado — atualize a lista'}
                    </span>
                </div>
            )}

            {guid !== null && (
                <div className={styles.guidRow}>
                    <label className={styles.guidLabel} htmlFor="generated-guid">
                        GUID gerado
                    </label>
                    <input
                        id="generated-guid"
                        type="text"
                        className={styles.guidInput}
                        value={guid}
                        readOnly
                    />
                </div>
            )}

            {guidError && (
                <div className={styles.formError} role="alert">
                    {guidError}
                </div>
            )}

            {feedback && (
                <div className={styles.feedback} role="status">
                    <span>{feedback}</span>
                    <button
                        type="button"
                        className={styles.feedbackClose}
                        onClick={() => setFeedback(null)}
                        aria-label="Fechar aviso"
                    >
                        ×
                    </button>
                </div>
            )}

            {notaError && (
                <div className={styles.formError} role="alert">
                    {notaError}
                </div>
            )}

            <input
                ref={notaFileInput}
                type="file"
                accept="application/pdf"
                className={styles.hiddenFileInput}
                onChange={handleNotaFileChange}
                tabIndex={-1}
                aria-hidden="true"
            />

            {loading ? (
                <SkeletonRows />
            ) : error ? (
                <div className={styles.statePanel} role="alert">
                    <svg
                        className={`${styles.stateIcon} ${styles.stateIconError}`}
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="12" cy="16.5" r="1.3" fill="currentColor" />
                        <path
                            d="M10.3 4.2 2.6 18a1.9 1.9 0 0 0 1.7 2.8h15.4a1.9 1.9 0 0 0 1.7-2.8L13.7 4.2a1.9 1.9 0 0 0-3.4 0Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                        />
                    </svg>
                    <p className={styles.stateTitle}>Não foi possível carregar os clientes</p>
                    <p className={styles.stateHint}>{error}</p>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={reload}
                    >
                        Tentar novamente
                    </button>
                </div>
            ) : customers.length === 0 ? (
                <div className={styles.statePanel}>
                    <svg
                        className={styles.stateIcon}
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M3 13h5l2 3h4l2-3h5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path d="M5 5.5h14v13H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    </svg>
                    <p className={styles.stateTitle}>Nenhum cliente cadastrado</p>
                    <p className={styles.stateHint}>
                        Cadastre o primeiro cliente para vê-lo aparecer aqui.
                    </p>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={openCreate}
                    >
                        Cadastrar cliente
                    </button>
                    <button
                        type="button"
                        className={styles.linkButton}
                        onClick={reload}
                    >
                        Atualizar
                    </button>
                </div>
            ) : (
                <>
                    <div className={styles.card}>
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        {sortableColumns.map(column => {
                                            const sortState = sortStateOf(column.key);
                                            return (
                                                <th
                                                    key={column.key}
                                                    scope="col"
                                                    aria-sort={
                                                        sortState.active
                                                            ? sortState.desc
                                                                ? 'descending'
                                                                : 'ascending'
                                                            : 'none'
                                                    }
                                                >
                                                    <button
                                                        type="button"
                                                        className={styles.sortButton}
                                                        onClick={() => handleSort(column.key)}
                                                    >
                                                        {column.label}
                                                        <SortIndicator {...sortState} />
                                                    </button>
                                                </th>
                                            );
                                        })}
                                        <th scope="col">E-mail</th>
                                        <th scope="col">Telefone</th>
                                        <th scope="col">CPF</th>
                                        <th scope="col">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className={styles.noResults}>
                                                <p className={styles.noResultsTitle}>
                                                    Nenhum cliente encontrado
                                                </p>
                                                <p className={styles.noResultsHint}>
                                                    Ajuste a busca para ver resultados.
                                                </p>
                                                <button
                                                    type="button"
                                                    className={styles.linkButton}
                                                    onClick={clearSearch}
                                                >
                                                    Limpar busca
                                                </button>
                                            </td>
                                        </tr>
                                    ) : (
                                        pageItems.map(customer => (
                                            <tr key={customer.id}>
                                                <td>
                                                    <div className={styles.customerCell}>
                                                        <span
                                                            className={styles.avatar}
                                                            style={{
                                                                backgroundColor: `hsl(${avatarHue(customer.name)} 45% 45%)`,
                                                            }}
                                                        >
                                                            {initials(customer.name)}
                                                            {customer.photo && (
                                                                <img
                                                                    className={styles.avatarImage}
                                                                    src={customerApi.getPhotoUrl(
                                                                        customer.id,
                                                                        customer.dateUpdated ??
                                                                            customer.dateCreated,
                                                                    )}
                                                                    alt={`Foto de ${customer.name}`}
                                                                    onError={event => {
                                                                        event.currentTarget.style.display =
                                                                            'none';
                                                                    }}
                                                                />
                                                            )}
                                                        </span>
                                                        <span className={styles.customerName}>
                                                            {customer.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={styles.muted}>{formatDate(customer.birthDate)}</td>
                                                <td className={styles.muted}>{formatDate(customer.dateCreated)}</td>
                                                <td className={styles.muted}>{customer.email}</td>
                                                <td className={styles.mono}>{customer.phone}</td>
                                                <td className={styles.mono}>{formatCpf(customer.cpf)}</td>
                                                <td>
                                                    <div className={styles.rowActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.iconButton}
                                                            onClick={() => openEdit(customer)}
                                                            title="Editar"
                                                            aria-label={`Editar ${customer.name}`}
                                                        >
                                                            <svg
                                                                width="15"
                                                                height="15"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                aria-hidden="true"
                                                            >
                                                                <path
                                                                    d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinejoin="round"
                                                                />
                                                                <path
                                                                    d="M13.5 6.5l3 3"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.iconButton}
                                                            onClick={() => openNotaPicker(customer)}
                                                            title="Subir nota fiscal (PDF)"
                                                            aria-label={`Subir nota fiscal de ${customer.name}`}
                                                            disabled={notaBusyId !== null}
                                                        >
                                                            <svg
                                                                width="15"
                                                                height="15"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                aria-hidden="true"
                                                            >
                                                                <path
                                                                    d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                                <path
                                                                    d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.iconButton}
                                                            onClick={() => handleDownloadNota(customer)}
                                                            title={
                                                                customer.notaFiscal
                                                                    ? 'Baixar nota fiscal (PDF)'
                                                                    : 'Nenhuma nota fiscal enviada'
                                                            }
                                                            aria-label={`Baixar nota fiscal de ${customer.name}`}
                                                            disabled={!customer.notaFiscal || notaBusyId !== null}
                                                        >
                                                            <svg
                                                                width="15"
                                                                height="15"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                aria-hidden="true"
                                                            >
                                                                <path
                                                                    d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                                <path
                                                                    d="M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                                            onClick={() => openDelete(customer)}
                                                            title="Excluir"
                                                            aria-label={`Excluir ${customer.name}`}
                                                        >
                                                            <svg
                                                                width="15"
                                                                height="15"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                aria-hidden="true"
                                                            >
                                                                <path
                                                                    d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-.8 12.1a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7"
                                                                    stroke="currentColor"
                                                                    strokeWidth="1.8"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <footer className={styles.pagination}>
                        <p className={styles.paginationInfo}>
                            {filtered.length === 0
                                ? 'Nenhum registro'
                                : `Exibindo ${firstItem}–${lastItem} de ${filtered.length} cliente${
                                      filtered.length === 1 ? '' : 's'
                                  }`}
                        </p>
                        {totalPages > 1 && (
                            <nav className={styles.paginationNav} aria-label="Paginação">
                                <button
                                    type="button"
                                    className={styles.pageButton}
                                    onClick={() => setPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    aria-label="Página anterior"
                                >
                                    ‹
                                </button>
                                {pages.map((item, index) =>
                                    item === 'gap' ? (
                                        <span
                                            key={`gap-${index}`}
                                            className={styles.pageGap}
                                            aria-hidden="true"
                                        >
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={item}
                                            type="button"
                                            className={`${styles.pageButton} ${
                                                item === currentPage ? styles.pageButtonActive : ''
                                            }`}
                                            aria-current={item === currentPage ? 'page' : undefined}
                                            onClick={() => setPage(item)}
                                        >
                                            {item}
                                        </button>
                                    ),
                                )}
                                <button
                                    type="button"
                                    className={styles.pageButton}
                                    onClick={() => setPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    aria-label="Próxima página"
                                >
                                    ›
                                </button>
                            </nav>
                        )}
                    </footer>
                </>
            )}

            {formModal.mode !== 'closed' && (
                <CustomerFormModal
                    customer={formModal.mode === 'edit' ? formModal.customer : null}
                    submitting={saving}
                    serverError={saveError}
                    onClose={closeForm}
                    onSubmit={handleSave}
                />
            )}

            {deleteTarget && (
                <ConfirmDeleteModal
                    customer={deleteTarget}
                    deleting={deleting}
                    error={deleteError}
                    onCancel={closeDelete}
                    onConfirm={handleDeleteConfirm}
                />
            )}
        </section>
    );
}
