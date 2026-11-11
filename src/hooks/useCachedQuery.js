import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { readCache, writeCache } from '../services/cacheService';

export function useCachedQuery(cacheKey, queryFn, staleTime = 15 * 60 * 1000, enabled = true) {
    const [entry, setEntry] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const data = entry?.key === cacheKey ? entry.data : null;

    const refresh = useCallback(async () => {
        if (!enabled) return null;
        setRefreshing(true);
        try {
            const freshData = await queryFn();
            setEntry({ key: cacheKey, data: freshData });
            await writeCache(cacheKey, freshData);
            return freshData;
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [cacheKey, enabled, queryFn]);

    useFocusEffect(useCallback(() => {
        if (!enabled) {
            setLoading(true);
            return undefined;
        }
        let active = true;

        async function load() {
            const cached = await readCache(cacheKey);
            if (!active) return;

            if (cached && Object.prototype.hasOwnProperty.call(cached, 'data')) {
                setEntry({ key: cacheKey, data: cached.data });
                setLoading(false);
                if (Date.now() - Number(cached.checkedAt || 0) < staleTime) return;
            } else {
                setLoading(true);
            }

            try {
                const freshData = await queryFn();
                if (!active) return;
                setEntry({ key: cacheKey, data: freshData });
                await writeCache(cacheKey, freshData);
            } catch {
                // Preserve cached data when the network is unavailable.
            } finally {
                if (active) setLoading(false);
            }
        }

        load();
        return () => { active = false; };
    }, [cacheKey, enabled, queryFn, staleTime]));

    return { data, loading, refreshing, refresh };
}
