import { createElement, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { StyleSheet, View } from 'react-native';
import { createLeafletMapHtml, parseMapMarkerMessage } from '../utils/leafletMapHtml';
import type { Coordinates, MapMarker } from '../types';

type Props = {
  center: Coordinates;
  markers: MapMarker[];
  showCurrentLocation: boolean;
  onMarkerPress?: (id: string) => void;
};

export function OpenStreetMapView({ center, markers, showCurrentLocation, onMarkerPress }: Props) {
  const { latitude, longitude } = center;
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(
    () => createLeafletMapHtml({ latitude, longitude }, markers, showCurrentLocation),
    [latitude, longitude, markers, showCurrentLocation],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const id = parseMapMarkerMessage(typeof event.data === 'string' ? event.data : '');
      if (id) onMarkerPress?.(id);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMarkerPress]);

  return (
    <View style={styles.frame}>
      {createElement('iframe', {
        title: 'Mapa de cuidadores de OpenStreetMap',
        ref: frameRef,
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
