import { KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Screen ({
    children,
    padding = 0,
    refreshControl,
    scroll = true,
    contentStyle,
    style,
    edges = ['top', 'bottom'],
}) {
    const content = scroll ? (
        <ScrollView
            refreshControl={refreshControl}
            contentContainerStyle={[styles.content, padding ? { padding } : null, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {children}
        </ScrollView>
    ) : (
        <KeyboardAvoidingView style={[styles.fixedContent, contentStyle]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {children}
        </KeyboardAvoidingView>
    );

    return (
        <>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView edges={edges} style={[styles.screen, style]}>
                {content}
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#fafafa",
    },
    content: {
        width: "100%",
        maxWidth: 600,
        alignSelf: "center",
        paddingBottom: 60,
        gap: 20,
        flexGrow: 1
    },
    fixedContent: {
        flex: 1,
    },
})
