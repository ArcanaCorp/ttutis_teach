import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../context/AuthContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
    const [fontsLoaded, fontError] = useFonts({
        'Outfit-Light': require('../../assets/fonts/Outfit-Light.ttf'),
        'Outfit-Regular': require('../../assets/fonts/Outfit-Regular.ttf'),
        'Outfit-Medium': require('../../assets/fonts/Outfit-Medium.ttf'),
        'Outfit-SemiBold': require('../../assets/fonts/Outfit-SemiBold.ttf'),
        'Outfit-Bold': require('../../assets/fonts/Outfit-Bold.ttf'),
    });

    useEffect(() => {
        if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
    }, [fontsLoaded, fontError]);

    if (!fontsLoaded && !fontError) return null;

    return (
        <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="observation" />
                <Stack.Screen name="class/[id]" />
                <Stack.Screen name="student/[id]" />
            </Stack>
        </AuthProvider>
    );
}
