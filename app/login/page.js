"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Identifiant ou mot de passe incorrect.");
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 32, borderRadius: 12, width: 340, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>UF2 - ERP Achats</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>Connexion</p>

        <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <label style={{ fontSize: 13, display: "block", margin: "12px 0 4px" }}>Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && <p style={{ color: "#B3261E", fontSize: 13, marginTop: 12 }}>{error}</p>}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ddd",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",
  marginTop: 20,
  padding: "10px",
  borderRadius: 6,
  border: "none",
  background: "#1B2430",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
};
