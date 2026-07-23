import assert from "node:assert/strict";
import { ensureCurrentSeason, seasonForDate } from "../season.mjs";

assert.deepEqual(seasonForDate("2026-08-31"), {
  id: null,
  anno_inizio: 2025,
  codice: "2025/2026",
  data_inizio: "2025-09-01",
  data_fine: "2026-08-31"
});

assert.deepEqual(seasonForDate("2026-09-01"), {
  id: null,
  anno_inizio: 2026,
  codice: "2026/2027",
  data_inizio: "2026-09-01",
  data_fine: "2027-08-31"
});

assert.equal(seasonForDate("2027-01-15").codice, "2026/2027");
assert.equal(seasonForDate("2027-09-01").codice, "2027/2028");

const databaseSeason = await ensureCurrentSeason({
  rpc: async () => ({
    data: [{
      id: 7,
      anno_inizio: 2026,
      codice: "2026/2027",
      data_inizio: "2026-09-01",
      data_fine: "2027-08-31"
    }],
    error: null
  })
});

assert.equal(databaseSeason.id, 7);
assert.equal(databaseSeason.codice, "2026/2027");

console.log("season.test.mjs: OK");
