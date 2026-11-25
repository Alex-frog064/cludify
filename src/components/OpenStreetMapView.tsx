import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import { createLeafletMapHtml, parseMapMarkerMessage } from '../utils/leafletMapHtml';
import { colors } from '../theme';
import type { Coordinates, MapMarker } from '../types';

type Props = {
  center: Coordinates;
  markers: MapMarker[];
  showCurrentLocation: boolean;
  selectedMarkerId?: string;
  onMarkerPress?: (id: string) => void;
};

export function OpenStreetMapView({ center, markers, showCurrentLocation, selectedMarkerId, onMarkerPress }: Props) {
  const { latitude, longitude } = center;
  const html = useMemo(
    () => createLeafletMapHtml({ latitude, longitude }, markers, showCurrentLocation, selectedMarkerId),
    [latitude, longitude, markers, selectedMarkerId, showCurrentLocation],
  );

  return (
    <WebView
      bounces={false}
      javaScriptEnabled
      onMessage={(event) => {
        const id = parseMapMarkerMessage(event.nativeEvent.data);
        if (id) onMarkerPress?.(id);
      }}
      originWhitelist={['*']}
      renderLoading={() => (
        <View style={styles.loading}>
          <ActivityIndicator color="#304A6E" />
        </View>
      )}
      scrollEnabled={false}
      source={{ html }}
      startInLoadingState
      style={styles.webView}
    />
  );
}

const styles = StyleSheet.create({
  webView: { backgroundColor: colors.map, flex: 1 },
  loading: { alignItems: 'center', backgroundColor: colors.map, flex: 1, justifyContent: 'center' },
});
