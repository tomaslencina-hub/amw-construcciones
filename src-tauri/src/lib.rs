use tauri::Manager;

// Guarda un PDF en la carpeta Descargas del usuario y devuelve la ruta
// completa, para que la app pueda abrir esa carpeta con el archivo
// seleccionado. Si ya existe uno con ese nombre no lo pisa: agrega " (2)",
// " (3)", etc.
#[tauri::command]
fn guardar_pdf(
    app: tauri::AppHandle,
    nombre: String,
    contenido: Vec<u8>,
) -> Result<String, String> {
    let carpeta = app.path().download_dir().map_err(|e| e.to_string())?;

    // Saca los caracteres que Windows no permite en nombres de archivo
    let limpio: String = nombre
        .chars()
        .map(|c| {
            if r#"\/:*?"<>|"#.contains(c) || c.is_control() {
                '_'
            } else {
                c
            }
        })
        .collect();

    let base = limpio.trim().trim_end_matches('.');
    let base = if base.is_empty() { "Presupuesto" } else { base };

    let mut ruta = carpeta.join(format!("{base}.pdf"));
    let mut numero = 2;

    while ruta.exists() {
        ruta = carpeta.join(format!("{base} ({numero}).pdf"));
        numero += 1;
    }

    std::fs::write(&ruta, contenido).map_err(|e| e.to_string())?;

    Ok(ruta.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        // Refuerza "decorations: false" de la config: la app dibuja sus
        // propios botones de minimizar y cerrar.
        .setup(|app| {
            if let Some(ventana) = app.get_webview_window("main") {
                let _ = ventana.set_decorations(false);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![guardar_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}