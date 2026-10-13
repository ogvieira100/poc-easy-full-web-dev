import { useEffect, useState } from "react";
import { ApiError, customersApi } from "../../services";

export default function Guids() {
    const [guid, setGuid] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;

        customersApi
            .getGuid()
            .then(response => {
                if (cancelled) {
                    return;
                }
                setGuid(response);
            })
            .catch((reason: unknown) => {
                if (cancelled) {
                    return;
                }
                setError(
                    reason instanceof ApiError ? reason.message : 'Falha ao gerar o GUID.',
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

    const handleReload = () => {
        setLoading(true);
        setError(null);
        setReloadKey(key => key + 1);
    };

    return (
        <>
            <h1>Guids</h1>
            {loading ? (
                <p>Carregando…</p>
            ) : error ? (
                <p role="alert">{error}</p>
            ) : (
                <p>{guid}</p>
            )}
            <button type="button" onClick={handleReload} disabled={loading}>
                Gerar novo GUID
            </button>
        </>
    );
}
