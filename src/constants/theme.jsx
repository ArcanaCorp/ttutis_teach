const supernova = {
    50: '#fefce8',
    100: '#fff9c2',
    200: '#ffef88',
    300: '#ffdf45',
    400: '#fdc908',
    500: '#edb205',
    600: '#cd8901',
    700: '#a36105',
    800: '#874c0c',
    900: '#723e11',
    950: '#431f05',
};

const woodsmoke = {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e6e6e6',
    300: '#d6d6d6',
    400: '#a5a5a5',
    500: '#767676',
    600: '#575757',
    700: '#434343',
    800: '#292929',
    900: '#181818',
    950: '#0a0a0a',
};

const states = {
    error: '#ff2323',
    success: '#00d672',
    warning: '#ffdf45',
    info: '#2f6dff',
};

export const theme = {
    colors: {
        primary: {
            ...supernova,
            DEFAULT: supernova[400],
            foreground: woodsmoke[950],
        },

        secondary: {
            ...woodsmoke,
            DEFAULT: woodsmoke[800],
            foreground: woodsmoke[50],
        },

        neutral: woodsmoke,

        background: {
            DEFAULT: '#ffffff',
            subtle: woodsmoke[50],
            muted: woodsmoke[100],
            elevated: '#ffffff',
        },

        surface: {
            DEFAULT: '#ffffff',
            secondary: woodsmoke[50],
            tertiary: woodsmoke[100],
            inverse: woodsmoke[900],
        },

        text: {
            primary: woodsmoke[950],
            secondary: woodsmoke[600],
            tertiary: woodsmoke[500],
            disabled: woodsmoke[400],
            inverse: '#ffffff',
            link: '#2f6dff',
        },

        border: {
            DEFAULT: woodsmoke[200],
            subtle: woodsmoke[100],
            strong: woodsmoke[300],
            focus: supernova[600],
        },

        state: {
            error: states.error,
            success: states.success,
            warning: states.warning,
            info: states.info,
        },

        stateBackground: {
            error: '#fff0f0',
            success: '#e8fff4',
            warning: '#fff9df',
            info: '#edf3ff',
        },

        overlay: 'rgba(10, 10, 10, 0.5)',
        transparent: 'transparent',
        white: '#ffffff',
        black: '#000000',
    },

    typography: {
        fontFamily: {
            light: "Outfit-Light",
            regular: "Outfit-Regular",
            medium: "Outfit-Medium",
            semibold: "Outfit-SemiBold",
            bold: "Outfit-Bold",
        },

        fontSize: {
            xs: 12,
            sm: 14,
            md: 16,
            lg: 18,
            xl: 20,
            '2xl': 24,
            '3xl': 30,
            '4xl': 36,
        },

        lineHeight: {
            tight: 1.2,
            normal: 1.5,
            relaxed: 1.7,
        },

        weight: {
            regular: '400',
            medium: '500',
            semibold: '600',
            bold: '700',
            extrabold: '800',
        },
    },

    spacing: {
        0: 0,
        1: 4,
        2: 8,
        3: 12,
        4: 16,
        5: 20,
        6: 24,
        8: 32,
        10: 40,
        12: 48,
        16: 64,
    },

    radius: {
        none: 0,
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        '2xl': 24,
        '3xl': 32,
        full: 9999,
    },

    shadows: {
        sm: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
        },
        lg: {
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 6,
        },
    },

    components: {
        button: {
            height: {
                sm: 36,
                md: 44,
                lg: 52,
            },
            radius: 12,
        },

        input: {
            height: 48,
            radius: 12,
            borderWidth: 1,
        },

        card: {
            radius: 20,
            padding: 16,
        },

        bottomSheet: {
            radius: 24,
        },
    },

    layout: {
        screenPadding: 20,
        contentMaxWidth: 600,
        headerHeight: 56,
        tabBarHeight: 64,
    },
};