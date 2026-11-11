import { StyleSheet, View } from 'react-native';
import { Users } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import { theme } from '../../constants/theme';
export default function AssistantGroups(){return <Screen><View style={s.header}><TextApp size="2xl" variant="bold">Mis grupos</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Aulas asignadas para seguimiento</TextApp></View><View style={s.empty}><View style={s.icon}><Users size={25} color={theme.colors.primary[800]}/></View><TextApp size="lg" variant="semibold">Grupos asignados</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">Aquí aparecerán las aulas que la institución te asigne para seguimiento.</TextApp><TextApp size="xs" color={theme.colors.text.tertiary} align="center">Esta asignación no limita el registro de asistencia institucional.</TextApp></View></Screen>}
const s=StyleSheet.create({header:{paddingHorizontal:20,paddingTop:22,gap:4},empty:{margin:20,marginTop:28,padding:24,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,alignItems:'center',gap:12},icon:{width:54,height:54,borderRadius:17,backgroundColor:theme.colors.primary[100],alignItems:'center',justifyContent:'center'}});
