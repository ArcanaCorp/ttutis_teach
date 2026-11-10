import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Screen from '../components/ui/Screen';
import TextApp from '../components/ui/TextApp';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { theme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { signIn, isConfigured } = useAuth();
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSignIn() {
        setLoading(true);
        setError('');
        try {
            await signIn(code, password);
            router.replace('/(tabs)/home');
        } catch (signInError) {
            setError(signInError.message || 'No se pudo iniciar sesión.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Screen padding={24}>
            <View style={styles.brand}>
                <Image source={require('../../assets/images/logo.png')} style={styles.logo} />
                <TextApp size="sm" color={theme.colors.text.secondary}>Espacio para docentes y auxiliares</TextApp>
            </View>
            <View style={styles.form}>
                <View style={styles.heading}>
                    <TextApp size="2xl" variant="bold">Bienvenido</TextApp>
                    <TextApp size="sm" color={theme.colors.text.secondary}>Ingresa con el código de acceso de tu institución.</TextApp>
                </View>
                <Input label="Código de acceso" placeholder="S12345678" required size="lg" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} returnKeyType="next" />
                <Input label="Contraseña" type="password" placeholder="Tu contraseña" required size="lg" value={password} onChangeText={setPassword} onSubmitEditing={handleSignIn} returnKeyType="go" />
                {!isConfigured && <TextApp size="xs" color={theme.colors.state.error}>Configura la conexión con TTUTIS en .env.local para iniciar sesión.</TextApp>}
                {!!error && <TextApp size="xs" color={theme.colors.state.error} accessibilityRole="alert">{error}</TextApp>}
                <Button fullWidth size="lg" loading={loading} disabled={!isConfigured || !code || !password} onPress={handleSignIn}>Ingresar</Button>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    brand: { 
        alignItems: 'center', 
        paddingTop: 44, 
        paddingBottom: 40, 
        gap: 8 
    },
    logo: {
        height: 80,
        objectFit: 'contain',
    },
    form: { 
        gap: 18 
    },
    heading: { 
        gap: 6, 
        marginBottom: 8 
    },
});
