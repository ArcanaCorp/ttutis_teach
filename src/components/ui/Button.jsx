import { Pressable, ActivityIndicator, Platform } from 'react-native';
import { theme } from '../../constants/theme';
import TextApp from './TextApp';

// Button variants

const variants = {
    primary: {
        background: theme.colors.primary.DEFAULT,
        foreground: theme.colors.primary.foreground,
        border: 'transparent',
        pressed: theme.colors.primary[500],
    },
    primarySoft: {
        background: theme.colors.primary[100],
        foreground: theme.colors.primary[900],
        border: 'transparent',
        pressed: theme.colors.primary[200],
    },

    secondary: {
        background: theme.colors.secondary.DEFAULT,
        foreground: theme.colors.secondary.foreground,
        border: 'transparent',
        pressed: theme.colors.secondary[900],
    },
    secondarySoft: {
        background: theme.colors.secondary[100],
        foreground: theme.colors.secondary[900],
        border: 'transparent',
        pressed: theme.colors.secondary[200],
    },

    outline: {
        background: 'transparent',
        foreground: theme.colors.text.primary,
        border: theme.colors.border.DEFAULT,
        pressed: theme.colors.background.muted,
    },
    ghost: {
        background: 'transparent',
        foreground: theme.colors.text.primary,
        border: 'transparent',
        pressed: theme.colors.background.muted,
    },

    danger: {
        background: theme.colors.state.error,
        foreground: '#FFFFFF',
        border: 'transparent',
        pressed: '#dc1616',
    },
    dangerSoft: {
        background: '#fee2e2',
        foreground: '#b91c1c',
        border: 'transparent',
        pressed: '#fecaca',
    },

    success: {
        background: theme.colors.state.success,
        foreground: theme.colors.primary.foreground,
        border: 'transparent',
        pressed: '#00b963',
    },
    successSoft: {
        background: '#dcfce7',
        foreground: '#166534',
        border: 'transparent',
        pressed: '#bbf7d0',
    },

    warning: {
        background: theme.colors.state.warning,
        foreground: theme.colors.primary.foreground,
        border: 'transparent',
        pressed: '#eac52f',
    },
    warningSoft: {
        background: '#fef9c3',
        foreground: '#854d0e',
        border: 'transparent',
        pressed: '#fef08a',
    },

    info: {
        background: theme.colors.states?.info ?? '#2f6dff',
        foreground: '#FFFFFF',
        border: 'transparent',
        pressed: '#1d4ed8',
    },
    infoSoft: {
        background: '#dbeafe',
        foreground: '#1e40af',
        border: 'transparent',
        pressed: '#bfdbfe',
    },

    link: {
        background: 'transparent',
        foreground: theme.colors.text.link,
        border: 'transparent',
        pressed: 'transparent',
    },
};

// Button sizes
const sizes = {
    xs: {
        height: 32,
        paddingHorizontal: 10,
        fontSize: 12,
        iconSize: 14,
        gap: 5,
    },
    sm: {
        height: 36,
        paddingHorizontal: 12,
        fontSize: 13,
        iconSize: 16,
        gap: 6,
    },
    md: {
        height: 44,
        paddingHorizontal: 16,
        fontSize: 14,
        iconSize: 18,
        gap: 8,
    },
    lg: {
        height: 52,
        paddingHorizontal: 20,
        fontSize: 16,
        iconSize: 20,
        gap: 8,
    },
    xl: {
        height: 56,
        paddingHorizontal: 24,
        fontSize: 17,
        iconSize: 22,
        gap: 10,
    },
};

const radiusValues = {
    none: 0,
    xs: theme.radius.xs,
    sm: theme.radius.sm,
    md: theme.radius.md,
    lg: theme.radius.lg,
    xl: theme.radius.xl,
    '2xl': theme.radius['2xl'],
    full: theme.radius.full,
};

export default function Button({
    children,

    // Appearance
    variant = 'primary',
    size = 'md',
    rounded = 'md',

    // Icon
    icon: Icon,
    iconPosition = 'left',
    iconOnly = false,
    iconSize,
    iconColor,
    iconStrokeWidth = 2,

    // State
    loading = false,
    disabled = false,

    // Layout
    fullWidth = false,
    flex = false,

    // Content
    loadingText,
    textStyle,
    containerStyle,

    // Interaction
    onPress,
    onLongPress,
    onPressIn,
    onPressOut,
    hitSlop = 8,

    // Accessibility
    accessibilityLabel,
    accessibilityHint,

    // Customization
    color,
    backgroundColor,
    borderColor,
    borderWidth,
    opacity = 0.5,
    elevation = 0,

    // Native props
    testID,
    androidRipple = true,

    ...rest
}) {
    const selectedVariant = variants[variant] || variants.primary;
    const selectedSize = sizes[size] || sizes.md;

    const isDisabled = disabled || loading;

    const foreground = color || selectedVariant.foreground;
    const background = backgroundColor || selectedVariant.background;

    const currentIconSize = iconSize || selectedSize.iconSize;
    const currentRadius = typeof rounded === 'number' ? rounded : radiusValues[rounded] ?? theme.radius.md;

    const showIcon = !!Icon;
    const showChildren = !iconOnly && !!children;

    const spinnerColor = foreground;

    const renderIcon = () => {
        if (!showIcon || loading) return null;
        return <Icon size={currentIconSize} color={iconColor || foreground} strokeWidth={iconStrokeWidth}/>
    };

    const buttonStyle = ({ pressed }) => ({
        minHeight: selectedSize.height,
        height: iconOnly ? selectedSize.height : undefined,

        paddingHorizontal: iconOnly ? 0 : selectedSize.paddingHorizontal,

        width: iconOnly ? selectedSize.height : fullWidth ? '100%' : undefined,

        alignSelf: fullWidth ? 'stretch' : 'flex-start',

        flex: flex ? 1 : undefined,

        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',

        gap: selectedSize.gap,

        backgroundColor: pressed && !isDisabled ? selectedVariant.pressed : background,

        borderRadius: currentRadius,

        borderWidth: borderWidth !== undefined ? borderWidth : variant === 'outline' ? 1 : 0,

        borderColor: borderColor || selectedVariant.border,

        opacity: isDisabled ? opacity : 1,

        ...(elevation > 0 ? {
            elevation,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
        }
        : {}),

        ...containerStyle,
    });

    const renderContent = () => {
        if (loading) {
            return (
                <>
                    <ActivityIndicator size="small" color={spinnerColor}/>

                    {loadingText ? (
                        <TextApp size={size === 'xs' || size === 'sm' ? 'sm' : 'md'} color={foreground} numberOfLines={1} style={textStyle}>{loadingText}</TextApp>
                    ) : null}
                </>
            );
        }

        if (iconOnly) {
            return renderIcon();
        }

        return (
            <>
                {iconPosition === 'left' && renderIcon()}

                {showChildren && (
                    <TextApp size={size === 'xs' || size === 'sm' ? 'sm' : 'md'} color={foreground} numberOfLines={1} style={textStyle}>{children}</TextApp>
                )}

                {iconPosition === 'right' && renderIcon()}
            </>
        );
    };

    return (
        <Pressable
            {...rest}
            testID={testID}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={isDisabled}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
            accessibilityHint={accessibilityHint}
            accessibilityState={{disabled: isDisabled, busy: loading,}}
            android_ripple={Platform.OS === 'android' && androidRipple && !isDisabled ? { color: 'rgba(10, 10, 10, 0.08)', borderless: false } : null}
            style={buttonStyle}
        >
            {renderContent()}
        </Pressable>
    );
}
