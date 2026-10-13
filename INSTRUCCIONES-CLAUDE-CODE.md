# Cotizador LNS — instrucciones de instalación (para Claude Code)

## Qué es
Cotizador estático (HTML + JS, sin servidor ni build) para Lube N Save Zona 10. Se abre desde TallerFLOW con:
`?ot=<núm. orden>&cliente=<nombre>&vehiculo=<marca modelo>` (valores con encodeURIComponent).

## Archivos (todos deben quedar en la raíz del sitio, con esta misma estructura)
- `index.html` — la app (no modificar salvo que se pida).
- `support.js` — runtime requerido por index.html.
- `lns-base.js` — lógica de base de datos (cargado con import dinámico).
- `historial-registros.json` — historial inicial (≈2.6 MB).
- `servicios.json` — plantilla oficial de servicios.
- `assets/` — logos (`logo-amarillo.png`, `logo-negro.png`) y PDF de ejemplo.
- `_ds/modernist-32da6ac4-a138-43b9-a1d6-92120778f901/` — `styles.css` y `_ds_bundle.js`.

Dependencias externas por CDN (no instalar nada): pdf.js 4.4.168 y JSZip 3.10.1 desde cdn.jsdelivr.net.

## Tareas
1. Crear un repositorio público en GitHub llamado `cotizador-lns` en la misma cuenta donde está TallerFLOW.
2. Subir todo el contenido de esta carpeta a la raíz de la rama `main` (incluye este archivo, no hace daño).
3. Activar GitHub Pages: rama `main`, carpeta `/ (root)`.
4. Verificar que `https://<usuario>.github.io/cotizador-lns/` carga sin 404 en: `support.js`, `lns-base.js`, `historial-registros.json`, `servicios.json`, `assets/logo-negro.png`, `_ds/.../styles.css`, `_ds/.../_ds_bundle.js`.
5. Verificar el puente: abrir `https://<usuario>.github.io/cotizador-lns/?ot=9999&cliente=Prueba&vehiculo=Toyota%20Hilux` y confirmar que aparece el mensaje "Datos recibidos de TallerFLOW · OT 9999".
6. En el repositorio de TallerFLOW, en la tarjeta/orden en fase **Presupuesto**, agregar (o actualizar) el botón "Cotizar" para que abra en pestaña nueva:
   ```js
   const url = 'https://<usuario>.github.io/cotizador-lns/'
     + '?ot=' + encodeURIComponent(ot)
     + '&cliente=' + encodeURIComponent(cliente)
     + '&vehiculo=' + encodeURIComponent(vehiculo);
   window.open(url, '_blank');
   ```
7. Reportar la URL final al usuario.

## Contrato de salida (lo que el cotizador entrega para pegar en TallerFLOW)
En el paso "03 Cliente", sección "Listados para TallerFLOW", dos bloques de texto separados por TAB, sin fila de títulos, una línea por renglón, solo lo autorizado:
- Repuestos y subcontratos: `Cantidad\tDescripción\tEspecificación`
- Mano de obra: `Tipo de operación\tDescripción\tHoras`

## Notas
- Los datos (historial, cotizaciones por OT, PIN, ajustes) se guardan en el navegador (IndexedDB/localStorage) por origen. Si TallerFLOW también está en `<usuario>.github.io`, comparten origen; las claves del cotizador empiezan con `lns-` y no deben chocar.
- Para actualizar el cotizador en el futuro: reemplazar los archivos y hacer push; no se pierde el historial guardado en los navegadores.
