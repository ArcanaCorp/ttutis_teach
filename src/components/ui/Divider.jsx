import { View, StyleSheet } from 'react-native';

import { theme } from '../../constants/theme';
import TextApp from './TextApp';

export default function Divider({
    // Content
    children,
    text,

    // Appearance
    color = theme.colors.border.DEFAULT,
    textColor = theme.colors.text.tertiary,
    thickness = 1,

    // Layout
    spacing = 16,
    textSpacing = 12,

    // Typography
    textSize = 'xs',
    textVariant = 'medium',

    // Layout options
    fullWidth = true,
    width,
    align = 'center',

    // Customization
    style,
    lineStyle,
    textStyle,
}) {
    
    const content = text || children;
    const hasText = content !== undefined && content !== null && content !== '';

    return (
        <View style={[styles.container, {width: fullWidth ? '100%' : width, marginVertical: spacing}, style]}>
            {hasText ? (
                <View style={styles.content}>
                    <View style={[styles.line, { backgroundColor: color, height: thickness }, lineStyle]}/>
                    <TextApp variant={textVariant} size={textSize} color={textColor} align="center" style={[{ marginHorizontal: textSpacing }, textStyle]}>{content}</TextApp>
                    <View style={[ styles.line, { backgroundColor: color, height: thickness }, lineStyle,]}/>
                </View>
            ) : (
                <View style={[styles.line, { backgroundColor: color, height: thickness, width: align === 'center' ? '100%' : '100%'}, lineStyle]}/>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
    },

    content: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },

    line: {
        flex: 1,
    },
});