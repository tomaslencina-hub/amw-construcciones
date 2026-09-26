import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { mostrarToast } from "./toast";

/**
 * Se llama una vez al iniciar la app. Si hay una versión nueva publicada,
 * la descarga, la instala y reinicia la app sola. Si no hay conexión, no
 * hay actualización, o la app corre en modo desarrollo (sin artefactos
 * firmados), falla en silencio: nunca interrumpe al usuario con un error.
 */
export async function comprobarActualizaciones() {
  try {
    const update = await check();

    if (!update) {
      return;
    }

    mostrarToast(`Descargando actualización ${update.version}...`);

    await update.downloadAndInstall();

    mostrarToast("Actualización instalada. Reiniciando...");

    setTimeout(() => {
      relaunch();
    }, 1500);
  } catch (e) {
    console.warn("No se pudo chequear actualizaciones:", e);
  }
}
