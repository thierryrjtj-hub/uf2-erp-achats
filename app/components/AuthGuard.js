"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Nav from "./Nav";

export default function AuthGuard({ children }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    console.log("🔵 AUTH : début getSession", new Date().toLocaleTimeString());

    supabase.auth.getSession().then(({ data }) => {

      console.log("🟢 AUTH : getSession terminé", new Date().toLocaleTimeString());

      if (!data.session) {
        router.replace("/login");
      } else {
        setReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  // Standard app entière : Entrée dans un champ = valider la saisie et lever la
  // sélection (comme Tabulation pour naviguer, mais Entrée pour "j'ai terminé").
  // Ça déclenche simplement l'événement onBlur déjà branché sur la plupart des
  // champs (enregistrement automatique), sans avoir à toucher chaque page.
  useEffect(() => {
    const surAppuiTouche = (e) => {
      if (e.key !== "Enter") return;
      const el = document.activeElement;
      if (!el) return;
      const estZoneTexte = el.tagName === "TEXTAREA";
      if (estZoneTexte && !e.ctrlKey && !e.metaKey) return;
      if (el.tagName === "INPUT" || estZoneTexte) {
        e.preventDefault();
        el.blur();
      }
    };
    document.addEventListener("keydown", surAppuiTouche);
    return () => document.removeEventListener("keydown", surAppuiTouche);
  }, []);

  // Ctrl+F (ou Cmd+F sur Mac) : au lieu de la recherche du navigateur, focalise
  // directement le champ de recherche de la page si elle en a un (repéré par
  // l'attribut data-search-field, posé sur les champs de recherche de l'appli).
  useEffect(() => {
    const surCtrlF = (e) => {
      if (!(e.key === "f" && (e.ctrlKey || e.metaKey))) return;
      const champ = document.querySelector("[data-search-field]");
      if (champ) {
        e.preventDefault();
        champ.focus();
        champ.select?.();
      }
    };
    document.addEventListener("keydown", surCtrlF);
    return () => document.removeEventListener("keydown", surCtrlF);
  }, []);

  // Journal des erreurs techniques : capture globale des erreurs JS non
  // gérées (bugs de code, promesses rejetées non interceptées) pour garder
  // une trace consultable dans Administration > Journal des erreurs, plutôt
  // que de les laisser disparaître une fois le message fermé ou la page
  // rechargée. Ne capture PAS les erreurs Supabase renvoyées normalement en
  // { error } (celles-ci doivent être signalées explicitement par la page
  // qui les reçoit, ce n'est pas encore fait partout).
  useEffect(() => {
    const enregistrerErreur = async (message, contexte) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("erreurs_techniques").insert({
          message: String(message).slice(0, 2000),
          contexte,
          url: window.location.pathname,
          utilisateur_id: user?.id || null,
        });
      } catch {
        // si l'enregistrement de l'erreur échoue lui-même, on n'insiste pas
      }
    };
    const surErreur = (e) =>
      enregistrerErreur(
        e.message || String(e.error || e),
        "Erreur JavaScript non gérée"
      );
    const surRejetNonGere = (e) =>
      enregistrerErreur(
        e.reason?.message || String(e.reason),
        "Promesse rejetée non interceptée"
      );
    window.addEventListener("error", surErreur);
    window.addEventListener("unhandledrejection", surRejetNonGere);
    return () => {
      window.removeEventListener("error", surErreur);
      window.removeEventListener("unhandledrejection", surRejetNonGere);
    };
  }, []);

  // Raccourcis clavier pour ouvrir un onglet sans la souris : on tape la (les)
  // première(s) lettre(s) du nom, ex. D = Demandes, DN = Demandes > Nouvelle
  // demande. Fonctionne uniquement quand on n'est pas en train de saisir du
  // texte ailleurs. Une courte pause (600ms) après la dernière touche valide
  // la navigation vers la correspondance la plus précise déjà tapée.
  useEffect(() => {
    const raccourcis = {
      T: "/dashboard",
      D: "/demandes",
      DL: "/demandes",
      DN: "/demandes/nouvelle",
      DP: "/petite-caisse",
      DC: "/carburant-gaz",
      C: "/commandes",
      H: "/historique",
      HV: "/historique",
      HB: "/historique/bois-chauffage",
      K: "/kpi",
      F: "/fournisseurs",
      FL: "/fournisseurs",
      FA: "/fournisseurs/nouveau",
      AR: "/articles",
      ARL: "/articles",
      ARN: "/articles/nouveau",
      ARG: "/articles/categories",
      AD: "/journal",
      ADJ: "/journal",
      ADQ: "/controle-qualite",
      ADE: "/erreurs",
      S: "/sauvegarde",
    };

    const raccourciActualiser = "R";
    let tampon = "";
    let minuteur = null;

    const aUnePossibiliteDePlus = (buf) =>
      buf !== raccourciActualiser &&
      (
        raccourciActualiser.startsWith(buf) ||
        Object.keys(raccourcis).some(
          (k) => k !== buf && k.startsWith(buf)
        )
      );

    const estValide = (buf) =>
      buf === raccourciActualiser || !!raccourcis[buf];

    const naviguer = () => {
      if (tampon === raccourciActualiser) {
        window.location.reload();
      } else if (raccourcis[tampon]) {
        router.push(raccourcis[tampon]);
      }
      tampon = "";
    };

    const surAppuiTouche = (e) => {
      const el = document.activeElement;
      const dansUnChamp =
        el &&
        (
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable
        );

      if (dansUnChamp || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!/^[a-zA-Z]$/.test(e.key)) return;

      const lettre = e.key.toUpperCase();
      const essai = tampon + lettre;

      if (estValide(essai) || aUnePossibiliteDePlus(essai)) {
        tampon = essai;
      } else if (estValide(lettre) || aUnePossibiliteDePlus(lettre)) {
        tampon = lettre;
      } else {
        tampon = "";
        return;
      }

      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(naviguer, 600);
    };

    document.addEventListener("keydown", surAppuiTouche);
    return () => {
      document.removeEventListener("keydown", surAppuiTouche);
      if (minuteur) clearTimeout(minuteur);
    };
  }, [router]);

  if (!ready) return <p style={{ padding: 24 }}>Chargement...</p>;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Nav />

      <div
        style={{
          flex: 1,
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <button
          onClick={() => window.location.reload()}
          className="no-print"
          title="Actualiser la page (raccourci : R)"
          style={{
            position: "fixed",
            top: 12,
            right: 16,
            zIndex: 50,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "1px solid #DDDBD3",
            background: "#fff",
            color: "#1E3A34",
            fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(16,24,40,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ↻
        </button>

        <div
          className="content-pane"
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            padding: "20px 32px 24px",
            maxWidth: 1400,
            margin: "0 auto",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
