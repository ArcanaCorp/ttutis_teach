import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@ttutis/cache/';

export async function readCache(key) {
    try {
        const raw = await AsyncStorage.getItem(`${PREFIX}${key}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export async function writeCache(key, data) {
    try {
        await AsyncStorage.setItem(`${PREFIX}${key}`, JSON.stringify({
            data,
            checkedAt: Date.now(),
        }));
    } catch {
        // Cache failures must never block the live data request.
    }
}
