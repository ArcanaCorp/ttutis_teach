import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Index() {
    const { session, loading } = useAuth();

    if (loading) {
        return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
    }

    return <Redirect href={session ? '/(tabs)/home' : '/login'} />;
}
