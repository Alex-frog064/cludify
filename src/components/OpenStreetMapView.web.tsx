import { createElement, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { StyleSheet, View } from 'react-native';
import { createLeafletMapHtml } from '../utils/leafletMapHtml';
import type { Coordinates, MapMarker } from '../types';

type Props = {
  center: Coordinates;
  markers: MapMarker[];
  showCurrentLocation: boolean;
};

export function OpenStreetMapView({ center, markers, showCurrentLocation }: Props) {
  const { latitude, longitude } = center;
  const html = useMemo(
    () => createLeafletMapHtml({ latitude, longitude }, markers, showCurrentLocation),
    [latitude, longitude, markers, showCurrentLocation],
  );

  return (
    <View style={styles.frame}>
      {createElement('iframe', {
        title: 'Mapa de cuidadores de OpenStreetMap',
        srcDoc: html,
        style: iframeStyle,
      })}
    </View>
  );
}

const iframeStyle: CSSProperties = { border: 'none', height: '100%', width: '100%' };

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden' },
});
