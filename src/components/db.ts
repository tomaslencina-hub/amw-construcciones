import Database from "@tauri-apps/plugin-sql";
import type { DatosPresupuesto } from "./formulario";

export interface PresupuestoGuardado {
  id: number;
  cliente: string;
  creadoEn: Date;
  total: number;
  datos: DatosPresupuesto;
}

export interface Material {
  id: number;
  proveedorId: number;
  nombre: string;
  unidad: string;
  precio: number;
  actualizadoEn: Date;
}

export interface Proveedor {
  id: number;
  nombre: string;
  materiales: Material[];
}

export interface DatosMaterial {
  nombre: string;
  unidad: string;
  precio: number;
}

interface FilaMaterial {
  id: number;
  proveedor_id: number;
  nombre: string;
  unidad: string;
  precio: number;
  actualizado_en: string;
}

interface FilaPresupuesto {
  id: number;
  cliente: string;
  creado_en: string;
  total: number;
  datos: string;
}

let dbPromise: Promise<Database> | null = null;

// Abre la base una sola vez (y crea la tabla si todavía no existe).
// El archivo queda en la carpeta de datos de la app.
function obtenerDB(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:presupuestos.db");

      await db.execute(`
        CREATE TABLE IF NOT EXISTS presupuestos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cliente TEXT NOT NULL,
          creado_en TEXT NOT NULL,
          total REAL NOT NULL,
          datos TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS proveedores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL
        )
      `);

      // actualizado_en guarda cuándo se cargó o cambió el precio por última
      // vez, para saber qué tan vigente es la referencia.
      await db.execute(`
        CREATE TABLE IF NOT EXISTS materiales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          proveedor_id INTEGER NOT NULL,
          nombre TEXT NOT NULL,
          unidad TEXT NOT NULL DEFAULT '',
          precio REAL NOT NULL,
          actualizado_en TEXT NOT NULL
        )
      `);

      return db;
    })();

    // Si falló la apertura, se reintenta en la próxima llamada
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }

  return dbPromise;
}

/**
 * Guarda el presupuesto completo (no el PDF): con esos datos se vuelve a
 * armar el mismo documento cuando se lo quiere ver o descargar de nuevo.
 * Si ya hay uno idéntico guardado (misma descarga repetida), no lo duplica.
 */
export async function guardarPresupuesto(
  datos: DatosPresupuesto
): Promise<void> {
  const db = await obtenerDB();
  const json = JSON.stringify(datos);

  const existentes = await db.select<{ id: number }[]>(
    "SELECT id FROM presupuestos WHERE datos = $1 LIMIT 1",
    [json]
  );

  if (existentes.length > 0) {
    return;
  }

  await db.execute(
    "INSERT INTO presupuestos (cliente, creado_en, total, datos) VALUES ($1, $2, $3, $4)",
    [datos.cliente.trim(), new Date().toISOString(), datos.totalGeneral, json]
  );
}

export async function listarPresupuestos(): Promise<PresupuestoGuardado[]> {
  const db = await obtenerDB();

  const filas = await db.select<FilaPresupuesto[]>(
    "SELECT id, cliente, creado_en, total, datos FROM presupuestos ORDER BY creado_en DESC, id DESC"
  );

  return filas.map((fila) => ({
    id: fila.id,
    cliente: fila.cliente,
    creadoEn: new Date(fila.creado_en),
    total: fila.total,
    datos: JSON.parse(fila.datos) as DatosPresupuesto,
  }));
}

// --- Proveedores y sus materiales ---

export async function listarProveedores(): Promise<Proveedor[]> {
  const db = await obtenerDB();

  const filasProveedores = await db.select<{ id: number; nombre: string }[]>(
    "SELECT id, nombre FROM proveedores ORDER BY nombre COLLATE NOCASE"
  );

  const filasMateriales = await db.select<FilaMaterial[]>(
    "SELECT id, proveedor_id, nombre, unidad, precio, actualizado_en FROM materiales ORDER BY nombre COLLATE NOCASE"
  );

  const proveedores: Proveedor[] = filasProveedores.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    materiales: [],
  }));

  const porId = new Map(proveedores.map((p) => [p.id, p]));

  filasMateriales.forEach((fila) => {
    porId.get(fila.proveedor_id)?.materiales.push({
      id: fila.id,
      proveedorId: fila.proveedor_id,
      nombre: fila.nombre,
      unidad: fila.unidad,
      precio: fila.precio,
      actualizadoEn: new Date(fila.actualizado_en),
    });
  });

  return proveedores;
}

export async function crearProveedor(nombre: string): Promise<number | null> {
  const db = await obtenerDB();

  const resultado = await db.execute(
    "INSERT INTO proveedores (nombre) VALUES ($1)",
    [nombre.trim()]
  );

  return resultado.lastInsertId ?? null;
}

export async function renombrarProveedor(
  id: number,
  nombre: string
): Promise<void> {
  const db = await obtenerDB();

  await db.execute("UPDATE proveedores SET nombre = $1 WHERE id = $2", [
    nombre.trim(),
    id,
  ]);
}

// Borra el proveedor junto con todos sus materiales
export async function eliminarProveedor(id: number): Promise<void> {
  const db = await obtenerDB();

  await db.execute("DELETE FROM materiales WHERE proveedor_id = $1", [id]);
  await db.execute("DELETE FROM proveedores WHERE id = $1", [id]);
}

export async function agregarMaterial(
  proveedorId: number,
  material: DatosMaterial
): Promise<void> {
  const db = await obtenerDB();

  await db.execute(
    "INSERT INTO materiales (proveedor_id, nombre, unidad, precio, actualizado_en) VALUES ($1, $2, $3, $4, $5)",
    [
      proveedorId,
      material.nombre,
      material.unidad,
      material.precio,
      new Date().toISOString(),
    ]
  );
}

// La fecha del precio solo se renueva si el precio cambió de verdad
// (en SQLite el CASE compara contra el valor anterior de la fila).
export async function actualizarMaterial(
  id: number,
  material: DatosMaterial
): Promise<void> {
  const db = await obtenerDB();

  await db.execute(
    `UPDATE materiales
     SET nombre = $1,
         unidad = $2,
         actualizado_en = CASE WHEN precio <> $3 THEN $4 ELSE actualizado_en END,
         precio = $5
     WHERE id = $6`,
    [
      material.nombre,
      material.unidad,
      material.precio,
      new Date().toISOString(),
      material.precio,
      id,
    ]
  );
}

export async function eliminarMaterial(id: number): Promise<void> {
  const db = await obtenerDB();

  await db.execute("DELETE FROM materiales WHERE id = $1", [id]);
}
