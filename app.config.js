module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Qualify usa tu ubicación para mostrarla en el mapa o establecer tu zona de servicio.',
      },
    ],
  ],
});
