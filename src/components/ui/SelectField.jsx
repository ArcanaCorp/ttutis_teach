import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
        {open && !disabled ? <View style={styles.menu}>
            {searchableHint ? <TextApp size="xs" color={theme.colors.text.tertiary} style={styles.hint}>{searchableHint}</TextApp> : null}
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.options} showsVerticalScrollIndicator>
                {options.map((item) => {
                    const active = item.value === value;
                    return <Pressable
                        key={String(item.value)}
                        onPress={() => { onChange?.(item.value); setOpen(false); }}
                        style={[styles.option, active && styles.optionActive]}
                    >
                        <TextApp size="sm" variant={active ? 'semibold' : 'regular'} style={{ flex: 1 }}>{item.label}</TextApp>
                        {active ? <Check size={16} color={theme.colors.primary[700]} /> : null}
                    </Pressable>;
                })}
                {!options.length ? <TextApp size="xs" color={theme.colors.text.tertiary} style={styles.hint}>No hay opciones disponibles.</TextApp> : null}
            </ScrollView>
        </View> : null}
    </View>;
}

const styles=StyleSheet.create({
    container:{gap:6},
    trigger:{minHeight:42,paddingHorizontal:12,paddingVertical:9,borderRadius:11,borderWidth:1,borderColor:theme.colors.border.DEFAULT,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
    triggerOpen:{borderColor:theme.colors.primary[600]},
    disabled:{opacity:0.55},
    menu:{borderWidth:1,borderColor:theme.colors.border.subtle,borderRadius:12,backgroundColor:'#fff',overflow:'hidden'},
    options:{maxHeight:190},
    option:{minHeight:40,paddingHorizontal:12,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:theme.colors.border.subtle},
    optionActive:{backgroundColor:theme.colors.primary[50]},
    hint:{paddingHorizontal:12,paddingVertical:8},
});
