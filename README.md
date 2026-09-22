# PandArmy Packs · Cloudflare Free

Página pública con catálogo de GitHub Releases, instalador Windows y administración exclusiva de `ElAbraxX`. Esta versión es independiente del proyecto anterior de Sites: no necesita R2, D1 ni pagos por almacenamiento. Cloudflare Workers Free aplica sus cuotas; GitHub aplica sus límites y condiciones. No activar Workers Paid ni R2.

## 1. Subir el proyecto

Extrae el ZIP. En el repositorio `ElAbraxX/abra-modpacks`, pulsa **Add file → Upload files**. Sube el contenido de esta carpeta a la raíz del repositorio, manteniendo las carpetas `public` y `tests`. No subas el ZIP como archivo ni lo adjuntes a Releases: estos son los archivos de la página. Confirma con **Commit changes**. Conserva las publicaciones existentes.

## 2. Publicar en Cloudflare

En la pantalla que conecta tu repositorio:

- Project name: `abra-modpacks`
- Build command: dejar vacío
- Deploy command: `npx wrangler deploy`
- Root directory: raíz del repositorio
- Desactiva Builds for non-production branches.
- No actives protección de toda la página con Cloudflare Access: las descargas son públicas.

Pulsa Deploy. La página puede publicarse antes de configurar el acceso; en ese estado nadie puede administrar. Guarda la dirección `https://abra-modpacks.TU-SUBDOMINIO.workers.dev` que devuelve Cloudflare.

## 3. Activar tu inicio de sesión

En GitHub → Settings → Developer settings → OAuth Apps → New OAuth App (https://github.com/settings/applications/new):

- Application name: `PandArmy Admin`
- Homepage URL: la dirección exacta publicada por Cloudflare.
- Authorization callback URL: esa dirección seguida de `/auth/callback`.

Registra la aplicación. En Cloudflare, abre el Worker → Settings → Variables and Secrets y añade:

- `GITHUB_CLIENT_ID`: el Client ID de la aplicación OAuth.
- `GITHUB_CLIENT_SECRET`: de tipo Secret; genera el secreto en GitHub y cópialo directamente aquí.
- `SESSION_SECRET`: de tipo Secret; contraseña aleatoria de al menos 32 caracteres, generada con un gestor de contraseñas. No reutilices tu contraseña personal.

Guarda/publica la configuración. No subas esos secretos al repositorio ni los compartas por chat. Pulsa Administrar en la página e inicia sesión con `ElAbraxX`. La aplicación solicita `public_repo` para guardar la apariencia en tu repositorio; ese permiso OAuth abarca tus repositorios públicos, aunque el código solo escribe `public/site-config.json` de `abra-modpacks`. Las otras cuentas se rechazan. No se admite administración basada únicamente en un correo enviado por el navegador.

La sesión dura una hora y se guarda cifrada en una cookie Secure/HttpOnly. El flujo OAuth usa state y PKCE. Las escrituras comprueban origen, sesión e identidad actual con GitHub. Para invalidar todas las sesiones, cambia SESSION_SECRET. Para retirar el permiso OAuth, revoca la aplicación en GitHub.

## Publicar packs y personalizar

Desde Administración, el botón Publicar modpack abre GitHub Releases. Crea una etiqueta nueva por versión, usa el nombre del pack como título, indica Minecraft/cargador en la descripción y adjunta el `.mrpack` o ZIP exportado de CurseForge. La web muestra archivos de hasta 1 GiB y omite borradores/prepublicaciones. No valida el manifiesto dentro del archivo remoto: el propietario debe exportarlo correctamente. Los ZIP van a CurseForge App; el instalador propio sigue siendo solo para .mrpack.

Pon al archivo el nombre que quieras ver al instalarlo: la descarga conserva el nombre del adjunto en GitHub. La página muestra el título de la publicación. El catálogo muestra las últimas 100 publicaciones y enlaza al archivo completo. Puede tardar hasta diez minutos en reflejar cambios. Si GitHub limita temporalmente su API pública, se muestra un enlace directo a Releases para seguir descargando.

Guardar apariencia actualiza `public/site-config.json` en GitHub. Cloudflare Builds debe seguir conectado a la rama principal: ese commit desencadena la publicación automática. El mensaje de guardado no significa que el despliegue haya terminado. Comprueba su estado en Cloudflare si tarda.

## Pruebas

`npm test` comprueba acceso, cifrado/caducidad, OAuth/PKCE, validación de apariencia, límite de 1 GiB y escritura de la configuración. `npx wrangler deploy --dry-run` valida el empaquetado sin publicar. Para desarrollo: `npx wrangler dev`.

El login real requiere crear la aplicación OAuth y configurar los secretos en tu cuenta. Ni estas credenciales ni la conexión de producción vienen incluidas en el ZIP.

Referencias: https://developers.cloudflare.com/workers/platform/limits/ · https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps · https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
