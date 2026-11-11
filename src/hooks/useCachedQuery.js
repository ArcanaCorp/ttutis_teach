import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { readCache, writeCache } from '../services/cacheService';

export function useCachedQuery(cacheKey, queryFn, staleTime = 5 * 60 * 1000) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const freshData = await queryFn();
            setData((current) => JSON.stringify(current) === JSON.stringify(freshData) ? current : freshData);
            await writeCache(cacheKey, freshData);
            return freshData;
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [cacheKey, queryFn]);

    useFocusEffect(useCallback(() => {
        let active = true;
        async function load() {
            const cached = await readCache(cacheKey);
            if (!active) return;
            if (cached && Object.hasOwn(cached, 'data')) {
                setData(cached.data);
                setLoading(false);
                if (Date.now() - Number(cached.checkedAt || 0) < staleTime) return;
            }

            try {
                const freshData = await queryFn();
                if (!active) return;
                setData((current) => JSON.stringify(current) === JSON.stringify(freshData) ? current : freshData);
                await writeCache(cacheKey, freshData);
            } catch {
                // Keep cached content visible when the network is unavailable.
            } finally {
                if (active) setLoading(false);
            }
        }
        load();
        return () => { active = false; };
    }, [cacheKey, queryFn, staleTime]));

    return { data, setData, loading, refreshing, refresh };
}
