import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Building2, LogOut, Mail, ShieldCheck } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../constants/theme';

export default function Profile() {
    const { session, staff, signOut } = useAuth();
    const [loading, setLoading] = useState(false);
    const displayName = staff?.displayName || session?.user?.user_metadata?.full_name || 'Personal educativo';
    const roleName = staff?.role === 'ASSISTANT' ? 'Auxiliar' : staff?.role === 'TEACHER' ? 'Docente' : 'Equipo educativo';

    async function handleSignOut() {
        setLoading(true);
        try { await signOut(); } catch (error) { Alert.alert('No se pudo cerrar sesión', error.message); } finally { setLoading(false); }
    }

    return (
        <Screen>
            <View style={styles.header}><TextApp size="2xl" variant="bold">Mi perfil</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Tu cuenta TTUTIS</TextApp></View>
            <View style={styles.profileCard}>
                <View style={styles.avatar}><Avatar name={displayName} size={60} /></View>
                <View style={styles.profileText}><TextApp size="lg" variant="semibold">{displayName}</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>{roleName}</TextApp></View>
            </View>
            <View style={styles.infoCard}>
                <Building2 size={20} color={theme.colors.primary[700]} />
                <View style={{ flex: 1, gap: 3 }}><TextApp size="xs" color={theme.colors.text.tertiary}>Institución</TextApp><TextApp size="sm" variant="medium">{staff?.institutionName || 'No disponible'}</TextApp></View>
            </View>
            <View style={styles.infoCard}>
                <Mail size={19} color={theme.colors.primary[700]} />
                <View style={{ flex: 1, gap: 3 }}><TextApp size="xs" color={theme.colors.text.tertiary}>Correo de la cuenta</TextApp><TextApp size="sm" variant="medium">{session?.user?.email || 'No disponible'}</TextApp></View>
            </View>
            <View style={styles.infoCard}>
                <ShieldCheck size={19} color={theme.colors.primary[700]} />
                <View style={{ flex: 1, gap: 3 }}><TextApp size="xs" color={theme.colors.text.tertiary}>Acceso</TextApp><TextApp size="sm" variant="medium">{staff?.role === 'ASSISTANT' ? 'Auxiliar escolar' : staff?.role === 'TEACHER' ? 'Docente' : 'Personal educativo'} · {staff?.status || 'Activo'}</TextApp></View>
            </View>
            <View style={styles.danger}>
                <Button fullWidth variant="dangerSoft" icon={LogOut} iconPosition="left" loading={loading} onPress={handleSignOut}>Cerrar sesión</Button>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: 22, gap: 4 },
    profileCard: { marginHorizontal: 20, marginTop: 12, padding: 18, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle, flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: theme.colors.primary[100], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    profileText: { flex: 1, gap: 4 },
    infoCard: { marginHorizontal: 20, padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border.subtle, flexDirection: 'row', alignItems: 'center', gap: 12 },
    danger: { marginHorizontal: 20, paddingVertical: 16, },
    email: { marginHorizontal: 20, gap: 5, paddingVertical: 4 },
});
