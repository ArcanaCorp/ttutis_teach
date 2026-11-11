import { useAuth } from '../../context/AuthContext';
import AssistantQrScanner from '../../components/assistant/AssistantQrScanner';
import TeacherQrScanner from '../../components/teacher/TeacherQrScanner';
export default function QrScreen(){const {staff}=useAuth();return staff?.role==='ASSISTANT'?<AssistantQrScanner/>:<TeacherQrScanner/>;}
