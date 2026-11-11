import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import TextApp from './TextApp';
import { theme } from '../../constants/theme';

export default function SelectField({
    label,
    value,
    options = [],
    onChange,
    placeholder = 'Seleccionar',
    disabled = false,
    searchableHint,
}) {
    const [open, setOpen] = useState(false);
    const selected = useMemo(() => options.find((item) => item.value === value), [options, value]);
    const orderedOptions = useMemo(() => selected
        ? [selected, ...options.filter((item) => item.value !== value)]
        : options, [options, selected, value]);

    return <View style={styles.container}>
        {label ? <TextApp size="xs" variant="semibold" color={theme.colors.text.secondary}>{label}</TextApp> : null}
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open, disabled }}
            disabled={disabled}
            onPress={() => setOpen((current) => !current)}
            style={[styles.trigger, open && styles.triggerOpen, disabled && styles.disabled]}
        >
            <TextApp size="sm" color={selected ? theme.colors.text.primary : theme.colors.text.tertiary} numberOfLines={1}>
                {selected?.label || placeholder}
            </TextApp>
            <ChevronDown size={17} color={theme.colors.text.secondary} />
        </Pressable>
        <Modal
            visible={open && !disabled}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setOpen(false)}
        >
            <View style={styles.modalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar opciones" />
                <View style={styles.menu}>
                    {searchableHint ? <TextApp size="xs" color={theme.colors.text.tertiary} style={styles.hint}>{searchableHint}</TextApp> : null}
                    {selected ? <View style={styles.selectedHeader}>
                        <TextApp size="xs" color={theme.colors.text.tertiary}>SELECCIONADO</TextApp>
                        <View style={styles.selectedValue}>
                            <TextApp size="sm" variant="semibold" style={{ flex: 1 }}>{selected.label}</TextApp>
                            <Check size={17} color={theme.colors.primary[700]} />
                        </View>
                    </View> : null}
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.options} showsVerticalScrollIndicator>
                        {orderedOptions.filter((item) => item.value !== value).map((item) => (
                            <Pressable
                                key={String(item.value)}
                                onPress={() => { onChange?.(item.value); setOpen(false); }}
                                style={styles.option}
                            >
                                <TextApp size="sm" style={{ flex: 1 }}>{item.label}</TextApp>
                            </Pressable>
                        ))}
                        {!options.length ? <TextApp size="xs" color={theme.colors.text.tertiary} style={styles.hint}>No hay opciones disponibles.</TextApp> : null}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    </View>;
}

const styles=StyleSheet.create({
    container:{gap:6},
    trigger:{minHeight:42,paddingHorizontal:12,paddingVertical:9,borderRadius:11,borderWidth:1,borderColor:theme.colors.border.DEFAULT,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
    triggerOpen:{borderColor:theme.colors.primary[600]},
    disabled:{opacity:0.55},
    modalOverlay:{flex:1,backgroundColor:'rgba(15,23,42,0.28)',justifyContent:'center',paddingHorizontal:28,paddingVertical:32},
    menu:{maxHeight:'72%',borderWidth:1,borderColor:theme.colors.border.subtle,borderRadius:16,backgroundColor:'#fff',overflow:'hidden',elevation:18,shadowColor:'#000',shadowOffset:{width:0,height:8},shadowOpacity:0.18,shadowRadius:18},
    selectedHeader:{paddingHorizontal:14,paddingTop:13,paddingBottom:9,borderBottomWidth:1,borderBottomColor:theme.colors.border.subtle,backgroundColor:theme.colors.primary[50],gap:7},
    selectedValue:{flexDirection:'row',alignItems:'center',gap:10},
    options:{maxHeight:190},
    option:{minHeight:40,paddingHorizontal:12,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:theme.colors.border.subtle},
    hint:{paddingHorizontal:12,paddingVertical:8},
});
