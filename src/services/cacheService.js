import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@ttutis/cache/';
const memoryCache = new Map();

export async function readCache(key) {
    if (memoryCache.has(key)) return memoryCache.get(key);
    try {
        const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
        const value = raw ? JSON.parse(raw) : null;
        if (value) memoryCache.set(key, value);
        return value;
    } catch {
        return null;
    }
}

export async function writeCache(key, data) {
    const value = { data, checkedAt: Date.now() };
    memoryCache.set(key, value);
    try {
        await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
    } catch {
        // Cache failures must never block the live data request.
    }
}
