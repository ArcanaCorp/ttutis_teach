import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { theme } from '../../constants/theme';

export default function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
    const opacity = useRef(new Animated.Value(0.45)).current;

    useEffect(() => {
        const animation = Animated.loop(Animated.sequence([
            Animated.timing(opacity, { toValue: 0.9, duration: 750, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.45, duration: 750, useNativeDriver: true }),
        ]));
        animation.start();
        return () => animation.stop();
    }, [opacity]);

    return <Animated.View style={[styles.base, { width, height, borderRadius: radius, opacity }, style]} />;
}

export function ScheduleSkeleton({ count = 3 }) {
    return (
        <View style={styles.list}>
            {Array.from({ length: count }, (_, index) => (
                <View key={index} style={styles.card}>
                    <View style={styles.time}>
                        <Skeleton width={42} height={13} />
                        <Skeleton width={34} height={10} />
                    </View>
                    <View style={styles.details}>
                        <Skeleton width="72%" height={15} />
                        <Skeleton width="48%" height={11} />
                        <Skeleton width="36%" height={11} />
                    </View>
                    <Skeleton width={18} height={18} radius={9} />
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    base: { backgroundColor: theme.colors.border.strong || '#D8DDE5' },
    list: { paddingHorizontal: 20, gap: 10, marginTop: 12 },
    card: { minHeight: 88, padding: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle, flexDirection: 'row', alignItems: 'center', gap: 14 },
    time: { minWidth: 52, gap: 8 },
    details: { flex: 1, gap: 8 },
});
