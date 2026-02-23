# [Voltrex SMS](https://matfon73.github.io/VoltrexSMS) 

Herramienta web para envío masivo de SMS y WhatsApp con carga de contactos desde archivos Excel. Construida en HTML, CSS y JavaScript vanilla, sin frameworks ni dependencias de backend.

---

## Estructura del proyecto

```
sms-masivo/
├── index.html      # Estructura HTML de la interfaz
├── styles.css      # Estilos y diseño visual
├── app.js          # Lógica de negocio y envíos
├── LICENSE         # licencia del codigo
└── README.md       # Este archivo
```

---

## Cómo usar

1. Descarga los 4 archivos y colócalos en la misma carpeta.
2. Abre `index.html` en tu navegador (Chrome o Firefox recomendado).
3. Sigue los pasos de la interfaz:

### Paso 1 — Cargar Excel
- Arrastra tu archivo `.xlsx`, `.xls` o `.csv` a la zona de carga, o haz clic para seleccionarlo.
- La herramienta detecta automáticamente las columnas de teléfono y nombre.

### Paso 2 — Mapear columnas
- Asigna qué columna corresponde al teléfono, nombre y campo extra.
- Haz clic en **Confirmar mapeo** para cargar los contactos.

### Paso 3 — Redactar mensaje
- Escribe tu mensaje en el área de texto (máximo 160 caracteres para GSM-7).
- Usa variables dinámicas para personalizar cada mensaje:

| Variable | Descripción |
|---|---|
| `{{nombre}}` | Nombre del contacto |
| `{{telefono}}` | Número de teléfono |
| `{{extra}}` | Campo extra del Excel |

### Paso 4 — Configurar proveedor y enviar
- Selecciona el canal (SMS o WhatsApp) e ingresa las credenciales de Twilio.
- Haz clic en **Enviar** y monitorea el progreso en tiempo real.

---

## Formato del Excel

El archivo debe tener una fila de encabezados y al menos una columna con números de teléfono.

| nombre | telefono | mensaje_extra |
|---|---|---|
| Juan Pérez | +573001234567 | VIP |
| María López | +573009876543 | Promo |

Los números deben incluir el prefijo internacional. Ejemplo: `+57` para Colombia, `+1` para EE.UU.

---

## Proveedor soportado: Twilio

Requiere cuenta en [twilio.com](https://www.twilio.com). Soporta dos canales:

### SMS

| Campo | Descripción |
|---|---|
| Account SID | Se encuentra en el dashboard de Twilio |
| Auth Token | Se encuentra en el dashboard de Twilio |
| Número remitente | Número comprado en Twilio (formato `+1XXXXXXXXXX`) |
| Messaging Service SID | Alternativa al número directo, recomendado para cuentas Trial |

Si se configuran ambos (número y Messaging Service SID), el SID tiene prioridad.

### WhatsApp

Usa la misma API de Twilio. Los números de destino se prefijan automáticamente con `whatsapp:`.

| Campo | Descripción |
|---|---|
| Account SID | Igual que en SMS |
| Auth Token | Igual que en SMS |
| Número remitente | Número de WhatsApp aprobado por Twilio, o `+14155238886` para el Sandbox |

Para usar el Sandbox, cada destinatario debe unirse previamente enviando el código de activación al +14155238886.

### Modo Demo

No requiere credenciales. Simula el envío de todos los mensajes con una tasa de éxito del 95% y muestra el flujo completo de la herramienta.

---

## Opciones avanzadas

| Opción | Descripción | Por defecto |
|---|---|---|
| Delay entre envíos | Milisegundos de espera entre cada mensaje | `200 ms` (SMS) / `500 ms` (WhatsApp) |
| Reintentos en error | Número de reintentos si un envío falla | `2` |
| Codificación | GSM-7 (160 chars) o UCS-2 Unicode (70 chars) | GSM-7 |

---

## Reporte de envíos

Al finalizar la campaña puedes exportar un archivo Excel con el resultado de cada envío:

| Columna | Descripción |
|---|---|
| Teléfono | Número del destinatario |
| Nombre | Nombre del contacto |
| Extra | Campo adicional |
| Estado | `sent` (enviado) o `error` (fallido) |
| Mensaje | Texto final enviado con variables sustituidas |

---

## Seguridad

Esta herramienta realiza las llamadas a la API de Twilio directamente desde el navegador. Es funcional para pruebas y uso interno, pero no es recomendable en producción porque expone las credenciales en el frontend.

Para producción se recomienda crear un backend propio que reciba los mensajes y llame a la API del proveedor, manteniendo las credenciales fuera del cliente:

```
Navegador → Tu Backend (Node.js / Python) → API Twilio
```

---

## Dependencias externas

Cargadas desde CDN, no requieren instalación:

| Librería | Versión | Uso |
|---|---|---|
| [SheetJS (xlsx)](https://sheetjs.com/) | 0.18.5 | Lectura de archivos Excel y CSV |
| [Font Awesome](https://fontawesome.com/) | 6.5.1 | Iconografía de la interfaz |
| [Google Fonts](https://fonts.google.com/) | — | Tipografías Syne y Space Mono |

---

## Compatibilidad

| Navegador | Soporte |
|---|---|
| Chrome 90+ | Compatible |
| Firefox 88+ | Compatible |
| Edge 90+ | Compatible |
| Safari 14+ | Compatible |
| Internet Explorer | No soportado |

---

## Licencia

Proyecto de uso libre. Modifica y adapta según tus necesidades.