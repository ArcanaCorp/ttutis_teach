import { ActivityIndicator, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { CalendarDays, ClipboardList, House, QrCode, UserRound } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../constants/theme';

export default function TabsLayout() {
    const { session, loading } = useAuth();
    if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
    if (!session) return <Redirect href="/login" />;

    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary[700],
            tabBarInactiveTintColor: theme.colors.text.tertiary,
            tabBarStyle: { height: 70, paddingTop: 8, paddingBottom: 9, backgroundColor: '#fff', borderTopColor: theme.colors.border.subtle },
            tabBarLabelStyle: { fontFamily: theme.typography.fontFamily.medium, fontSize: 10, marginTop: 3 },
        }}>
            <Tabs.Screen name="home" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <House size={size} color={color} /> }} />
            <Tabs.Screen name="schedule" options={{ title: 'Horario', tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} /> }} />
            <Tabs.Screen name="qr" options={{ title: 'QR', tabBarIcon: ({ color, size }) => <QrCode size={size} color={color} /> }} />
            <Tabs.Screen name="assessments" options={{ title: 'Evaluaciones', tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} /> }} />
            <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} /> }} />
            <Tabs.Screen name="assessment/[id]" options={{ href: null }} />
            <Tabs.Screen name="observation" options={{ href: null }} />
        </Tabs>
    );
}
