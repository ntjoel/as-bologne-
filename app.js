
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://uiypmfkfwcvdujkvsjxp.supabase.co"; // <-- cambia
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpeXBtZmtmd2N2ZHVqa3ZzanhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTE2MTAsImV4cCI6MjA5NjgyNzYxMH0.iPvSXzsXPQRJdXURELrjjWOoi68MV7w9yONbt17VXew";  // <-- incolla la tua anon key

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadMatches() {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("data", { ascending: true });

  if (error) { console.error(error); return; }
  renderMatches(data); // usa i dati reali
async function submitAvailability(matchId, nome, disponibile) {
  const { error } = await supabase
    .from("disponibilita")
    .upsert({
      match_id: matchId,
      nome: nome,
      disponibile: disponibile
    }, { onConflict: "match_id,nome" });

  if (!error) showSuccess("Risposta registrata!");
}
async function adminLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email, password
  });
  if (error) { showError("Credenziali errate"); return; }
  showAdminPanel(); // mostra il pannello
}

