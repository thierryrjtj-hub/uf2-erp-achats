"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const MAX_TENTATIVES = 3;

export default function LoginPage() {
  const [identifiant, setIdentifiant] = useState("");
  const [password, setPassword] = useState("");
  const [voirMotDePasse, setVoirMotDePasse] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bloque, setBloque] = useState(false);
  const [etape, setEtape] = useState("connexion"); // "connexion" | "changerMdp"
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmMdp, setConfirmMdp] = useState("");
  const [erreurMdp, setErreurMdp] = useState("");
  const [enregistrementMdp, setEnregistrementMdp] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const memorise = localStorage.getItem("uf2_username");
    if (memorise) setIdentifiant(memorise);
  }, []);

  useEffect(() => {
    if (!identifiant.trim()) { setBloque(false); return; }
    const tentatives = Number(localStorage.getItem(cleTentatives(identifiant.trim())) || 0);
    setBloque(tentatives >= MAX_TENTATIVES);
  }, [identifiant]);

  const cleTentatives = (u) => `uf2_tentatives_${u.toLowerCase()}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cle = cleTentatives(identifiant.trim());
    const tentativesActuelles = Number(localStorage.getItem(cle) || 0);
    if (tentativesActuelles >= MAX_TENTATIVES) {
      setBloque(true);
      setError("Trop de tentatives échouées. Contacte l'administrateur (Judicaël) pour réinitialiser ton mot de passe.");
      return;
    }

    setLoading(true);
    let email = identifiant.trim();
    if (!email.includes("@")) {
      const { data, error: lookupError } = await supabase
        .from("app_usernames")
        .select("email")
        .ilike("username", email)
        .maybeSingle();
      if (lookupError || !data) {
        setLoading(false);
        setError("Nom d'utilisateur introuvable.");
        return;
      }
      email = data.email;
    }

    const { data: session, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const nouveauTotal = tentativesActuelles + 1;
      localStorage.setItem(cle, String(nouveauTotal));
      if (nouveauTotal >= MAX_TENTATIVES) {
        setBloque(true);
        setError("Trop de tentatives échouées. Contacte l'administrateur (Judicaël) pour réinitialiser ton mot de passe.");
      } else {
        setError(`Identifiant ou mot de passe incorrect (${nouveauTotal}/${MAX_TENTATIVES} tentatives).`);
      }
      return;
    }

    localStorage.removeItem(cle);
    localStorage.setItem("uf2_username", identifiant.trim());

    // Première connexion : mot de passe temporaire à changer avant d'entrer dans l'appli
    const { data: profil } = await supabase.from("profiles").select("mot_de_passe_a_changer").eq("id", session.user.id).maybeSingle();
    if (profil?.mot_de_passe_a_changer) {
      setEtape("changerMdp");
      return;
    }

    router.push("/dashboard");
  };

  const handleChangerMdp = async (e) => {
    e.preventDefault();
    setErreurMdp("");
    if (nouveauMdp.length < 6) { setErreurMdp("Le mot de passe doit faire au moins 6 caractères."); return; }
    if (nouveauMdp !== confirmMdp) { setErreurMdp("Les deux mots de passe ne correspondent pas."); return; }

    setEnregistrementMdp(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: err1 } = await supabase.auth.updateUser({ password: nouveauMdp });
    if (err1) {
      setEnregistrementMdp(false);
      setErreurMdp("Erreur lors du changement de mot de passe. Réessaie.");
      return;
    }
    if (userData?.user) {
      await supabase.from("profiles").update({ mot_de_passe_a_changer: false }).eq("id", userData.user.id);
    }
    setEnregistrementMdp(false);
    router.push("/dashboard");
  };

  if (etape === "changerMdp") {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
        <form onSubmit={handleChangerMdp} style={{ background: "#fff", padding: 32, borderRadius: 12, width: 340, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <img src="/logo-hv.png" alt="UNIFOODS" style={{ height: 64 }} />
          </div>
          <h1 style={{ fontSize: 18, marginBottom: 4, textAlign: "center" }}>Première connexion</h1>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 20, textAlign: "center" }}>
            Merci de choisir ton propre mot de passe — lui seul le connaîtra à partir de maintenant.
          </p>

          <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Nouveau mot de passe</label>
          <input type="password" value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} required style={inputStyle} />

          <label style={{ fontSize: 13, display: "block", margin: "12px 0 4px" }}>Confirmer le mot de passe</label>
          <input type="password" value={confirmMdp} onChange={(e) => setConfirmMdp(e.target.value)} required style={inputStyle} />

          {erreurMdp && <p style={{ color: "#B3261E", fontSize: 13, marginTop: 12 }}>{erreurMdp}</p>}

          <button type="submit" disabled={enregistrementMdp} style={buttonStyle}>
            {enregistrementMdp ? "Enregistrement..." : "Valider et entrer dans l'appli"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 32, borderRadius: 12, width: 340, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/logo-hv.png" alt="UNIFOODS" style={{ height: 64 }} />
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 4, textAlign: "center" }}>Achats Locaux</h1>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 20, textAlign: "center" }}>Connexion</p>

        <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Nom d'utilisateur</label>
        <input
          type="text"
          value={identifiant}
          onChange={(e) => setIdentifiant(e.target.value)}
          required
          style={inputStyle}
        />

        <label style={{ fontSize: 13, display: "block", margin: "12px 0 4px" }}>Mot de passe</label>
        <div style={{ position: "relative" }}>
          <input
            type={voirMotDePasse ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, paddingRight: 38 }}
          />
          <button
            type="button"
            onClick={() => setVoirMotDePasse((v) => !v)}
            style={oeilBtn}
            aria-label={voirMotDePasse ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            title={voirMotDePasse ? "Masquer" : "Afficher"}
          >
            {voirMotDePasse ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>

        {error && <p style={{ color: "#B3261E", fontSize: 13, marginTop: 12 }}>{error}</p>}

        <button type="submit" disabled={loading || bloque} style={{ ...buttonStyle, opacity: bloque ? 0.5 : 1, cursor: bloque ? "not-allowed" : "pointer" }}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <p style={{ fontSize: 11, color: "#bbb", marginTop: 24, textAlign: "center" }}>
          Créé par Judicaël Randrianaivo — UNIFOODS
        </p>
      </form>
    </div>
  );
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
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

const oeilBtn = {
  position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
  border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center",
};

const buttonStyle = {
  width: "100%",
  marginTop: 20,
  padding: "10px",
  borderRadius: 6,
  border: "none",
  background: "#1E3A34",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
};
