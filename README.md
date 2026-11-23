# Qualify

Prototipo móvil de Qualify, una app para encontrar cuidadores de personas mayores. Está hecho con Expo, React Native y TypeScript.

## Iniciar

```bash
npm install
npm start
```

Abre el proyecto con Expo Go o ejecuta `npm run android` / `npm run ios` para usar un emulador.

## Mapa y ubicación

La pantalla Explorar muestra Leaflet dentro de una WebView y utiliza teselas de OpenStreetMap. No requiere una clave de Google Maps. La atribución a OpenStreetMap se muestra en el mapa y se necesita conexión a internet para cargar Leaflet y las teselas. El servidor público de teselas de OpenStreetMap tiene una política de uso: para tráfico de producción elevado se debe elegir un proveedor de teselas adecuado.

La ubicación del dispositivo es opcional; si no se concede permiso, se usa Del Valle como zona de demostración. Socket.IO es independiente del proveedor de mapas: puede conectar la app con una API para solicitudes o marcadores en tiempo real cuando se defina el endpoint y los eventos del servidor.

## Estructura

- `App.tsx`: navegación y estado local de sesión.
- `src/screens/`: explorar y cuenta familiar; espacio de cuidador con notificaciones, mensajes, clientes y perfil; autenticación y alta de cuidador.
- `src/components/`: tarjetas de cuidador y navegación inferior.
- `src/data/`: datos de demostración tipados; no hay API ni base de datos conectada.

El registro permite elegir entre familia y cuidador. El alta de cuidador guía por foto opcional, zona de servicio manual o ubicación actual, datos profesionales, experiencia, especialidades y disponibilidad. Al cuidador se le muestran secciones distintas: Notificaciones, Mensajes, Clientes y Perfil. Todo es una demostración local: los datos y la foto no se envían ni se guardan, y la cédula/RFC no se verifican. Los cuidadores, clientes, notificaciones y mensajes también son contenido de muestra.
