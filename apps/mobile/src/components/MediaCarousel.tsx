import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ProductMedia } from '../api/types';
import { colors, radius, spacing } from '../theme';

const { width } = Dimensions.get('window');
const CAROUSEL_HEIGHT = width; // square, matches the thumbnail grid below it

function VideoSlide({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.media} contentFit="cover" nativeControls />;
}

function Slide({ item }: { item: ProductMedia }) {
  return (
    <View style={styles.slide}>
      {item.type === 'VIDEO' ? (
        <VideoSlide url={item.url} />
      ) : (
        <Image source={{ uri: item.url }} style={styles.media} resizeMode="cover" />
      )}
    </View>
  );
}

interface Props {
  media: ProductMedia[];
}

export default function MediaCarousel({ media }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<ProductMedia>>(null);

  if (media.length === 0) {
    return <View style={[styles.media, styles.placeholder]} />;
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== activeIndex) setActiveIndex(index);
  };

  const goTo = (index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  };

  return (
    <View>
      <FlatList
        ref={listRef}
        data={media}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <Slide item={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      {media.length > 1 && (
        <View style={styles.dots}>
          {media.map((m, i) => (
            <View key={m.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {media.length > 1 && (
        <View style={styles.thumbRow}>
          {media.map((m, i) => (
            <View
              key={m.id}
              style={[styles.thumbWrap, i === activeIndex && styles.thumbActive]}
              onTouchEnd={() => goTo(i)}
            >
              {m.type === 'VIDEO' ? (
                <View style={[styles.thumb, styles.videoThumb]} />
              ) : (
                <Image source={{ uri: m.url }} style={styles.thumb} resizeMode="cover" />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { width },
  media: { width: '100%', height: CAROUSEL_HEIGHT, backgroundColor: colors.chip },
  placeholder: { backgroundColor: colors.chip },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  thumbRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  thumbWrap: { width: 48, height: 48, borderRadius: radius.sm, overflow: 'hidden' },
  thumbActive: { borderWidth: 2, borderColor: colors.primary },
  thumb: { width: '100%', height: '100%' },
  videoThumb: { backgroundColor: colors.text },
});
