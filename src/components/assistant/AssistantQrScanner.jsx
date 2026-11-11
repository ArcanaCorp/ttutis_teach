import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { Camera, QrCode } from 'lucide-react-native';
import Screen from '../ui/Screen';
import TextApp from '../ui/TextApp';
import Button from '../ui/Button';
import { theme } from '../../constants/theme';
export default function AssistantQrScanner(){
 const [permission,requestPermission]=useCameraPermissions(); const [scanned,setScanned]=useState(false); const focused=useIsFocused();
 const onScanned=({data})=>{if(scanned)return;setScanned(true);Alert.alert('Código leído','El escáner está listo. El registro global se habilitará al conectar la validación de permisos y horarios del servidor.',[{text:'Entendido',onPress:()=>setScanned(false)}]);};
 return <Screen scroll={false} contentStyle={s.page}><View style={s.header}><View style={s.icon}><QrCode size={22} color={theme.colors.primary[900]}/></View><View style={{flex:1,gap:3}}><TextApp size="xl" variant="bold">Asistencia institucional</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>Escanea el QR de cualquier alumno activo</TextApp></View></View>
 {!permission?<View style={s.permission}><ActivityIndicator/></View>:!permission.granted?<View style={s.permission}><Camera size={34} color={theme.colors.primary[800]}/><TextApp size="lg" variant="semibold">Permite el acceso a la cámara</TextApp><TextApp size="sm" color={theme.colors.text.secondary} align="center">La cámara se utiliza para leer el código QR del alumno.</TextApp><Button onPress={requestPermission}>Permitir cámara</Button></View>:<View style={s.scanner}>{focused&&<CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={scanned?undefined:onScanned}/>}<View style={s.overlay} pointerEvents="none"><View style={s.frame}/><TextApp size="sm" color="#fff" align="center">Centra el QR del alumno en el marco</TextApp></View>{scanned&&<View style={s.retry}><Button size="sm" onPress={()=>setScanned(false)}>Escanear otro</Button></View>}</View>}
 <View style={s.notice}><TextApp size="sm" variant="semibold">Ventana de asistencia</TextApp><TextApp size="xs" color={theme.colors.text.secondary}>El servidor comprobará el horario institucional y clasificará el ingreso como puntual, tarde o falta. Esta vista previa no registra eventos.</TextApp></View></Screen>;
}
const s=StyleSheet.create({page:{flex:1,gap:14,paddingBottom:10},header:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingTop:12},icon:{width:44,height:44,borderRadius:14,backgroundColor:theme.colors.primary[100],alignItems:'center',justifyContent:'center'},scanner:{flex:1,minHeight:320,marginHorizontal:16,borderRadius:22,overflow:'hidden',backgroundColor:'#171717'},overlay:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',gap:18,backgroundColor:'rgba(0,0,0,0.12)'},frame:{width:230,height:230,borderWidth:3,borderColor:theme.colors.primary[300],borderRadius:26},retry:{position:'absolute',bottom:18,alignSelf:'center'},permission:{flex:1,alignItems:'center',justifyContent:'center',gap:14,padding:24},notice:{marginHorizontal:20,padding:15,borderRadius:16,backgroundColor:theme.colors.primary[100],gap:5}});
