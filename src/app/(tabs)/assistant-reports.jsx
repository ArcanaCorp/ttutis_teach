import { StyleSheet, View } from 'react-native';
import { FileText, Plus } from 'lucide-react-native';
import Screen from '../../components/ui/Screen';
import TextApp from '../../components/ui/TextApp';
import Button from '../../components/ui/Button';
import { theme } from '../../constants/theme';
export default function AssistantReports(){return <Screen><View style={s.header}><TextApp size="2xl" variant="bold">Reportes</TextApp><TextApp size="sm" color={theme.colors.text.secondary}>Incidencias y seguimiento de alumnos</TextApp></View><View style={s.empty}><View style={s.icon}><FileText size={25} color={theme.colors.primary[800]}/></View><TextApp size="lg" variant="semibold">Tus reportes</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">Aquí podrás registrar y consultar reportes de convivencia, incidencias y seguimiento.</TextApp><Button disabled icon={Plus}>Nuevo reporte</Button><TextApp size="xs" color={theme.colors.text.tertiary} align="center">La creación y consulta se habilitarán al conectar el servicio de reportes.</TextApp></View></Screen>}
const s=StyleSheet.create({header:{paddingHorizontal:20,paddingTop:22,gap:4},empty:{margin:20,marginTop:28,padding:24,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:theme.colors.border.subtle,alignItems:'center',gap:12},icon:{width:54,height:54,borderRadius:17,backgroundColor:theme.colors.primary[100],alignItems:'center',justifyContent:'center'}});
