import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Mode = "login" | "signup";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!email || !password) {
      setMessage("Email et mot de passe requis.");
      setLoading(false);
      return;
    }

    try {
      const { error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (error) {
        setMessage(error.message);
      } else if (mode === "signup") {
        setMessage("Compte créé. Vérifie ta boîte mail si besoin.");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erreur inattendue, réessaie.";
      setMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>Connexion</h1>
      <p className="muted">
        Utilise ton email pour {mode === "login" ? "te connecter" : "créer un compte"}.
      </p>

      <form onSubmit={handleSubmit} className="stack">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="toi@exemple.com"
          />
        </label>

        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
          />
        </label>

        {message && <div className="message">{message}</div>}

        <button type="submit" className="primary" disabled={loading}>
          {loading
            ? "Chargement..."
            : mode === "login"
              ? "Se connecter"
              : "Créer un compte"}
        </button>
      </form>

      <button
        type="button"
        className="link"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login"
          ? "Créer un compte"
          : "J'ai déjà un compte"}
      </button>
    </div>
  );
}
