// Esqueleto mientras carga una sección del panel: encabezado + bloque de contenido,
// con las mismas barras animate-pulse que usan las tablas y tarjetas.
export default function AdministrarLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Cargando">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 animate-pulse rounded-md bg-white/5" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-white/5" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/3 border border-white/6" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-white/3 border border-white/6" />
    </div>
  )
}
