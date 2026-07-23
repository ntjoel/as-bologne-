const padYear = value => String(value).padStart(4, "0");

export function seasonForDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Data stagione non valida");

  const year = date.getFullYear();
  const startYear = date.getMonth() >= 8 ? year : year - 1;

  return {
    id: null,
    anno_inizio: startYear,
    codice: `${startYear}/${startYear + 1}`,
    data_inizio: `${padYear(startYear)}-09-01`,
    data_fine: `${padYear(startYear + 1)}-08-31`
  };
}

function normalizeSeason(season) {
  if (!season) return null;
  return {
    id: season.id ?? null,
    anno_inizio: Number(season.anno_inizio),
    codice: season.codice,
    data_inizio: season.data_inizio,
    data_fine: season.data_fine
  };
}

export async function ensureCurrentSeason(supabase, now = new Date()) {
  const fallback = seasonForDate(now);
  const { data, error } = await supabase.rpc("assicura_stagione_corrente");

  if (error) {
    console.warn("Migrazione stagioni non disponibile:", error.message);
    return fallback;
  }

  const season = normalizeSeason(Array.isArray(data) ? data[0] : data);
  return season?.codice ? season : fallback;
}

export async function loadSeasons(supabase, currentSeason) {
  const { data, error } = await supabase
    .from("stagioni")
    .select("id,anno_inizio,codice,data_inizio,data_fine")
    .order("anno_inizio", { ascending: false });

  if (error) {
    console.warn("Archivio stagioni non disponibile:", error.message);
    return [currentSeason];
  }

  const seasons = (data || []).map(normalizeSeason).filter(Boolean);
  if (!seasons.some(season => season.codice === currentSeason.codice)) {
    seasons.unshift(currentSeason);
  }
  return seasons;
}

export function applySeasonLabel(season, root = document) {
  root.querySelectorAll("[data-current-season]").forEach(element => {
    element.textContent = `Saison ${season.codice}`;
  });
}

