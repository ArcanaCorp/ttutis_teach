import { Text, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';

const variants = {
    default: {
        fontFamily: theme.typography.fontFamily.regular,
    },
    light: {
        fontFamily: theme.typography.fontFamily.light,
    },
    regular: {
        fontFamily: theme.typography.fontFamily.regular,
    },
    medium: {
        fontFamily: theme.typography.fontFamily.medium,
    },
    semibold: {
        fontFamily: theme.typography.fontFamily.semibold,
    },
    bold: {
        fontFamily: theme.typography.fontFamily.bold,
    },
};

const sizes = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
};

const alignments = {
    left: 'left',
    center: 'center',
    right: 'right',
    justify: 'justify',
};

const lineHeights = {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
};

export default function TextApp({
    children,

    // Typography
    variant = 'regular',
    size = 'md',
    color = theme.colors.text.primary,
    align = 'left',
    lineHeight = 'normal',

    // Layout
    numberOfLines,
    letterSpacing,
    textTransform,

    // Decoration
    underline = false,
    italic = false,

    // Native
    selectable = false,
    adjustsFontSizeToFit = false,
    minimumFontScale = 0.8,

    // Custom styles
    style,

    ...rest
}) {
    
    const selectedVariant = variants[variant] || variants.regular;
    const selectedSize = sizes[size] || sizes.md;
    const selectedAlignment = alignments[align] || alignments.left;
    const selectedLineHeight = lineHeights[lineHeight] || lineHeights.normal;

    return (
        <Text
            {...rest}
            selectable={selectable}
            numberOfLines={numberOfLines}
            adjustsFontSizeToFit={adjustsFontSizeToFit}
            minimumFontScale={minimumFontScale}
            style={[
                styles.text,
                selectedVariant,
                {
                    fontSize: selectedSize,
                    color,
                    textAlign: selectedAlignment,
                    lineHeight: selectedSize * selectedLineHeight,
                    letterSpacing,
                    textDecorationLine: underline ? 'underline' : 'none',
                    fontStyle: italic ? 'italic' : 'normal',
                    textTransform,
                },
                style,
            ]}
        >
            {children}
        </Text>
    );
}

const styles = StyleSheet.create({
    text: {
        includeFontPadding: false,
    },
});