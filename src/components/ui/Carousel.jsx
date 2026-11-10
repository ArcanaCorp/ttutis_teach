import { ScrollView, View, StyleSheet, Image } from 'react-native';
import TextApp from './TextApp';
import { theme } from '../../constants/theme';

export default function Carousel({ data = [], renderItem, keyExtractor, cardWidth = 280, gap = 12, paddingHorizontal = 24, showsIndicator = false, style, contentContainerStyle }) {
    
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={showsIndicator}
            contentContainerStyle={[
                styles.container,
                {
                    paddingHorizontal,
                    gap,
                },
                contentContainerStyle,
            ]}
            style={style}
        >
            {data.map((item, index) => (
                <View
                    key={keyExtractor ? keyExtractor(item, index) : item.id ?? index}
                    style={{ width: cardWidth }}
                >
                    {renderItem
                        ? renderItem({ item, index })
                        : <CarouselCard item={item} />}
                </View>
            ))}
        </ScrollView>
    );
}

function CarouselCard({ item }) {
    return (
        <View style={styles.card}>
            {item.image && (
                <Image
                    source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                    style={styles.image}
                    resizeMode="cover"
                />
            )}

            <View style={styles.cardContent}>
                {item.title && (
                    <TextApp variant="semibold" size="lg">
                        {item.title}
                    </TextApp>
                )}

                {item.description && (
                    <TextApp size="sm" color={theme.colors.text.secondary}>
                        {item.description}
                    </TextApp>
                )}

                {item.content}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'stretch',
    },

    card: {
        flex: 1,
        backgroundColor: theme.colors.surface.DEFAULT,
        borderRadius: theme.components.card.radius,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
    },

    image: {
        width: '100%',
        height: 150,
    },

    cardContent: {
        padding: theme.components.card.padding,
        gap: theme.spacing[2],
    },
});