import { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Eye, EyeOff, Search, X, CircleAlert, CircleCheck } from 'lucide-react-native';

import { theme } from '../../constants/theme';
import TextApp from './TextApp';

// Input appearances
const appearances = {
    outlined: {
        background: theme.colors.surface.DEFAULT,
        borderWidth: 1,
    },
    filled: {
        background: theme.colors.background.muted,
        borderWidth: 1,
    },
    underline: {
        background: 'transparent',
        borderWidth: 0,
    },
};

// Input sizes
const sizes = {
    sm: {
        height: 40,
        fontSize: 14,
        iconSize: 17,
        paddingHorizontal: 12,
        radius: theme.radius.sm,
    },
    md: {
        height: 48,
        fontSize: 15,
        iconSize: 19,
        paddingHorizontal: 14,
        radius: theme.radius.md,
    },
    lg: {
        height: 56,
        fontSize: 16,
        iconSize: 21,
        paddingHorizontal: 16,
        radius: theme.radius.lg,
    },
};

export default function Input({
    // Content
    value,
    defaultValue,
    onChangeText,

    // Input type
    type = 'text',
    secureTextEntry,

    // Appearance
    appearance = 'outlined',
    size = 'md',
    radius,

    // Label
    label,
    required = false,

    // Placeholder
    placeholder = 'Escribe aquí...',
    placeholderTextColor = theme.colors.text.tertiary,

    // Icons
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    onRightIconPress,
    iconSize,
    iconColor,

    // Password
    showPasswordToggle = true,

    // Search
    clearable = false,
    onClear,

    // States
    error,
    success = false,
    disabled = false,
    readOnly = false,

    // Messages
    helperText,
    errorMessage,
    successMessage,

    // Multiline
    multiline = false,
    numberOfLines = 4,
    minHeight,
    maxHeight,

    // Character count
    maxLength,
    showCharacterCount = false,

    // Native input
    keyboardType,
    autoCapitalize,
    autoCorrect,
    autoComplete,
    textContentType,
    returnKeyType,
    secureTextEntryProps,

    // Behavior
    autoFocus = false,
    editable = true,
    selectTextOnFocus = false,
    blurOnSubmit,
    onSubmitEditing,
    onFocus,
    onBlur,

    // Layout
    fullWidth = true,
    containerStyle,
    wrapperStyle,
    inputStyle,

    // Accessibility
    accessibilityLabel,
    accessibilityHint,

    // Native props
    testID,
    maxFontSizeMultiplier = 1.5,

    ...rest
}) {

    const [focused, setFocused] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [internalValue, setInternalValue] = useState(defaultValue || '');

    const currentValue = value !== undefined ? value : internalValue;
    const textValue = currentValue == null ? '' : String(currentValue);

    const selectedSize = sizes[size] || sizes.md;
    const selectedAppearance = appearances[appearance] || appearances.outlined;

    const isPassword = type === 'password';
    const isSearch = type === 'search';
    const isMultiline = type === 'multiline' || multiline === true;

    const isDisabled = disabled || !editable;
    const isReadOnly = readOnly;

    const hasError = !!(error || errorMessage);
    const hasSuccess = success && !hasError;

    const isSecure = secureTextEntry !== undefined ? secureTextEntry : isPassword && !passwordVisible;

    const currentRadius = typeof radius === 'number' ? radius : theme.radius[radius || 'md'];

    const currentIconSize = iconSize || selectedSize.iconSize;

    // Colors
    const borderColor = isDisabled ? theme.colors.border.subtle : hasError ? theme.colors.state.error : hasSuccess ? theme.colors.state.success : focused ? theme.colors.border.focus : theme.colors.border.DEFAULT;

    const foreground = isDisabled ? theme.colors.text.disabled : theme.colors.text.primary;

    const mutedColor = isDisabled ? theme.colors.text.disabled : iconColor || theme.colors.text.tertiary;

    // Keyboard configuration
    const defaultKeyboardTypes = {
        text: 'default',
        password: 'default',
        search: 'default',
        email: 'email-address',
        number: 'numeric',
        decimal: 'decimal-pad',
        phone: 'phone-pad',
        url: 'url',
    };

    const currentKeyboardType = keyboardType || defaultKeyboardTypes[type] || 'default';

    const currentAutoCapitalize = autoCapitalize || (type === 'email' || isPassword || isSearch ? 'none' : 'sentences');

    const currentAutoCorrect = autoCorrect !== undefined ? autoCorrect : !isPassword && !isSearch && type !== 'email';

    // Update value
    const handleChangeText = (text) => {
        if (value === undefined) {
        setInternalValue(text);
        }

        onChangeText?.(text);
    };

    // Clear input
    const handleClear = () => {
        if (value === undefined) {
        setInternalValue('');
        }

        onChangeText?.('');
        onClear?.();
    };

    // Focus
    const handleFocus = (event) => {
        setFocused(true);
        onFocus?.(event);
    };

    // Blur
    const handleBlur = (event) => {
        setFocused(false);
        onBlur?.(event);
    };

    // Automatic icons
    const AutomaticLeftIcon = isSearch ? Search : null;

    const AutomaticRightIcon = hasError ? CircleAlert : hasSuccess ? CircleCheck : null;

    const FinalLeftIcon = LeftIcon || AutomaticLeftIcon;

    const showPasswordAction = isPassword && showPasswordToggle;

    const showClearAction = clearable && !isPassword && textValue.length > 0 && !isReadOnly;

    const FinalRightIcon = showPasswordAction ? passwordVisible ? EyeOff : Eye : RightIcon || AutomaticRightIcon;

    const showRightIcon = !!FinalRightIcon && !showClearAction;

    const message = hasError ? errorMessage || (typeof error === 'string' ? error : null) : hasSuccess ? successMessage : helperText;

    const messageColor = hasError ? theme.colors.state.error : hasSuccess ? theme.colors.state.success : theme.colors.text.tertiary;

    return (
        <View style={[styles.container, fullWidth && styles.fullWidth, containerStyle ]}>

            {label ? (
                <View style={styles.labelContainer}>
                    <TextApp variant="medium" size="sm" color={isDisabled ? theme.colors.text.disabled : theme.colors.text.primary}>{label}</TextApp>

                    {required && (
                        <TextApp variant="semibold" size="sm" color={theme.colors.state.error}>{' *'}</TextApp>
                    )}
                </View>
            ) : null}

            <View
                style={[
                    styles.wrapper,
                    {
                        height: isMultiline ? undefined : selectedSize.height,
                        minHeight: isMultiline ? minHeight || 110 : undefined,

                        borderRadius: currentRadius,
                        backgroundColor: isDisabled ? theme.colors.background.muted : selectedAppearance.background,

                        borderWidth: selectedAppearance.borderWidth,
                        borderColor,

                        borderBottomWidth: appearance === 'underline' ? 1 : selectedAppearance.borderWidth,

                        opacity: isDisabled ? 0.65 : 1,
                    },

                    focused && !isDisabled && styles.focused,
                    wrapperStyle,
                ]}
            >

                {FinalLeftIcon ? (
                    <View style={styles.iconContainer}>
                        <FinalLeftIcon size={currentIconSize} color={mutedColor} strokeWidth={2} />
                    </View>
                ) : null}

                <TextInput
                    {...rest}
                    testID={testID}
                    value={value !== undefined ? value : internalValue}
                    onChangeText={handleChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={placeholderTextColor}
                    editable={!isDisabled && !isReadOnly}
                    selectTextOnFocus={selectTextOnFocus}
                    autoFocus={autoFocus}
                    autoCapitalize={currentAutoCapitalize}
                    autoCorrect={currentAutoCorrect}
                    autoComplete={autoComplete}
                    textContentType={textContentType}
                    keyboardType={currentKeyboardType}
                    returnKeyType={returnKeyType || (isSearch ? 'search' : 'done')}
                    secureTextEntry={isSecure}
                    multiline={isMultiline}
                    numberOfLines={isMultiline ? numberOfLines : 1}
                    maxLength={maxLength}
                    blurOnSubmit={blurOnSubmit}
                    onSubmitEditing={onSubmitEditing}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    accessibilityLabel={accessibilityLabel || label || placeholder}
                    accessibilityHint={accessibilityHint}
                    maxFontSizeMultiplier={maxFontSizeMultiplier}
                    textAlignVertical={isMultiline ? 'top' : 'center'}
                    underlineColorAndroid="transparent"
                    style={[
                        styles.input,
                        {
                            fontFamily: theme.typography.fontFamily.regular,
                            fontSize: selectedSize.fontSize,
                            color: foreground,
                            height: isMultiline ? undefined : '100%',
                            minHeight: isMultiline ? minHeight || 110 : undefined,
                            maxHeight: isMultiline ? maxHeight : undefined,
                            paddingVertical: isMultiline ? 12 : 0,
                            paddingHorizontal: selectedSize.paddingHorizontal,
                        },
                        inputStyle,
                    ]}
                />

                {showClearAction && (
                    <Pressable onPress={handleClear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Limpiar campo" style={styles.action}>
                        <X size={currentIconSize} color={mutedColor} />
                    </Pressable>
                )}

                {showRightIcon && (
                    <Pressable
                        onPress={showPasswordAction ? () => setPasswordVisible((prev) => !prev) : onRightIconPress}
                        disabled={showPasswordAction ? false : !onRightIconPress}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={showPasswordAction ? passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña' : undefined}
                        style={styles.action}
                    >
                        <FinalRightIcon size={currentIconSize} color={mutedColor} strokeWidth={2} />
                    </Pressable>
                )}
            </View>

            {(message || showCharacterCount) && (
                <View style={styles.footer}>
                    <View style={styles.messageContainer}>
                        {message ? ( <TextApp variant="regular" size="xs" color={messageColor}>{message}</TextApp> ) : null}
                    </View>
                    {showCharacterCount && maxLength ? ( <TextApp variant="regular" size="xs" color={theme.colors.text.tertiary}>{textValue.length}/{maxLength}</TextApp> ) : null}
                </View>
            )}

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 7,
    },

    fullWidth: {
        width: '100%',
    },

    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        overflow: 'hidden',
    },

    focused: {
        shadowColor: theme.colors.border.focus,
        shadowOffset: {
        width: 0,
        height: 0,
        },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 1,
    },

    iconContainer: {
        paddingLeft: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },

    input: {
        flex: 1,
        paddingVertical: 0,
        includeFontPadding: false,
    },

    action: {
        minWidth: 42,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },

    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
    },

    messageContainer: {
        flex: 1,
    },
});