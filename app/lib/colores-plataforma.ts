// Colores de las plataformas en los gráficos del Dashboard (Compras a proveedores, Margen por producto).

// Color oficial de cada plataforma (pedido del usuario), por su nombre en business.platform. Solo se aclaran los que no se ven
// sobre la card oscura (Max). Apple TV es negro: va en blanco. Combos no es una marca: amarillo (no lo usa ninguna plataforma). Varios oficiales se
// parecen entre sí (azules, rojos): la leyenda y el tooltip siempre dicen el nombre, el color no es lo único que identifica.
export const COLOR_MARCA: Record<string, string> = {
    NETFLIX: "#E50914",
    DISNEY: "#0063E5",
    HBO: "#991EEB",
    MAX: "#2E5BFF",
    AMAZON: "#00A8E1",
    CRUNCHYROLL: "#F47521",
    "APPLE TV": "#FFFFFF",
    SPOTIFY: "#1DB954",
    YOUTUBE: "#FF0000",
    PARAMOUNT: "#0064FF",
    "VIX+": "#FF5A00",
    CANVA: "#00C4CC",
    DEEZER: "#A238FF",
    PLEX: "#E5A00D",
    "CLARO VIDEO": "#DA291C",
    "DIRECTV GO": "#00A6D6",
    DUOLINGO: "#58CC02",
    OFFICE: "#D83B01",
    PORNHUB: "#FF9000",
    COMBOS: "#FACC15",
}
// Plataforma sin color de marca (o producto sin plataforma): el siguiente de la paleta categórica validada (dataviz).
export const COLORES_LIBRES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"]

/** Color de cada plataforma: el de su marca, o uno libre en orden fijo (según el gasto de todo el historial). */
export function coloresPara(ranking: string[]): Map<string, string> {
    let libre = 0
    return new Map(ranking.map((n) => [n, COLOR_MARCA[n.toUpperCase()] ?? COLORES_LIBRES[libre++ % COLORES_LIBRES.length]]))
}
