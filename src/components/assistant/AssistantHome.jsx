import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CalendarDays, FileText, QrCode, Users, ChevronRight, Clock3 } from 'lucide-react-native';
import { router } from 'expo-router';
import Screen from '../ui/Screen';
import TextApp from '../ui/TextApp';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../constants/theme';

export default function AssistantHome() {
 const { staff } = useAuth();
 const now = useMemo(() => new Date(), []);
 const dateLabel = now.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'});
 const actions = [
  {title:'Registrar asistencia',subtitle:'Escanea el QR de cualquier alumno',icon:QrCode,path:'/(tabs)/qr'},
  {title:'Mis grupos',subtitle:'Consulta los grupos asignados',icon:Users,path:'/(tabs)/assistant-groups'},
  {title:'Crear reporte',subtitle:'Registra una incidencia o seguimiento',icon:FileText,path:'/(tabs)/assistant-reports'},
 ];
 return <Screen>
  <View style={s.header}><View style={{flex:1,gap:4}}><TextApp size="2xl" variant="bold">Hola, {staff?.displayName?.split(' ')[0] || 'Auxiliar'}</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>{staff?.institutionName || 'Tu institución'}</TextApp></View><View style={s.role}><TextApp size="xs" variant="semibold">Auxiliar</TextApp></View></View>
  <View style={s.body}>
   <View style={s.date}><CalendarDays size={17} color={theme.colors.primary[700]}/><TextApp size="sm" variant="medium" textTransform="capitalize">{dateLabel}</TextApp></View>
   <View style={s.banner}><View style={s.bannerIcon}><Clock3 size={22} color={theme.colors.primary[800]}/></View><View style={{flex:1,gap:4}}><TextApp size="md" variant="semibold" color={theme.colors.primary[950]}>Control de asistencia</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Registra ingresos y revisa incidencias de la jornada.</TextApp></View></View>
   <TextApp size="lg" variant="bold">Accesos rápidos</TextApp>
   {actions.map((item)=>{const Icon=item.icon;return <Pressable key={item.title} style={s.action} onPress={()=>router.push(item.path)}><View style={s.actionIcon}><Icon size={21} color={theme.colors.primary[800]}/></View><View style={{flex:1,gap:3}}><TextApp size="md" variant="semibold">{item.title}</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>{item.subtitle}</TextApp></View><ChevronRight size={19} color={theme.colors.text.tertiary}/></Pressable>})}
   <View style={s.note}><TextApp size="sm" variant="semibold">Asistencia institucional</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>El auxiliar puede registrar asistencia de alumnos activos de toda la institución. Los grupos asignados se usan únicamente para seguimiento.</TextApp></View>
  </View>
 </Screen>;
}
const s=StyleSheet.create({header:{padding:20,backgroundColor:'#fff',borderBottomWidth:1,borderColor:theme.colors.border.subtle,flexDirection:'row',alignItems:'center',gap:10},role:{paddingHorizontal:11,paddingVertical:7,borderRadius:20,backgroundColor:theme.colors.primary[100]},body:{padding:20,gap:16},date:{flexDirection:'row',alignItems:'center',gap:8},banner:{padding:17,borderRadius:18,backgroundColor:theme.colors.primary[100],flexDirection:'row',alignItems:'center',gap:12},bannerIcon:{width:44,height:44,borderRadius:14,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},action:{padding:15,borderRadius:17,borderWidth:1,borderColor:theme.colors.border.subtle,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',gap:12},actionIcon:{width:42,height:42,borderRadius:13,backgroundColor:theme.colors.primary[50],alignItems:'center',justifyContent:'center'},note:{padding:15,borderRadius:16,backgroundColor:'#fff',gap:6,borderWidth:1,borderColor:theme.colors.border.subtle}});
