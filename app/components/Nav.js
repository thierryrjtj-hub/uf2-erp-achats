"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { BRAND, ACCENT } from "./ui";

const LINKS = [
  { href: "/dashboard", label: "Tableau de bord", icon: IconGrid },
  {
    href: "/demandes", label: "Demandes", icon: IconFile,
    children: [
      { href: "/demandes", label: "Liste des demandes" },
      { href: "/demandes/nouvelle", label: "Nouvelle demande" },
    ],
  },
  { href: "/commandes", label: "Commandes", icon: IconCart },
  {
    href: "/historique", label: "Historique", icon: IconClock,
    children: [
      { href: "/historique", label: "Vue globale" },
      { href: "/historique/bois-chauffage", label: "Bois de chauffage" },
    ],
  },
  { href: "/kpi", label: "KPI", icon: IconChart },
  { href: "/fournisseurs", label: "Fournisseurs", icon: IconTruck },
  {
    href: "/articles", label: "Articles", icon: IconBox,
    children: [
      { href: "/articles", label: "Liste des articles" },
      { href: "/articles/nouveau", label: "Ajouter un article" },
    ],
  },
  { href: "/journal", label: "Journal d'audit", icon: IconList },
  { href: "/sauvegarde", label: "Sauvegarde", icon: IconSave },
];

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="nav-sidebar" style={{ width: 226, height: "100vh", background: BRAND, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div className="nav-logo-chip" style={{ padding: "22px 18px 18px" }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "8px 12px", display: "inline-block" }}>
          <img src="/logo-hv.png" alt="UNIFOODS" style={{ height: 36, display: "block" }} />
        </div>
      </div>

      <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {LINKS.map((l) => {
          const actif = pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <div key={l.href}>
              <Link
                href={l.href}
                title={l.label}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 8,
                  fontSize: 13.5, textDecoration: "none",
                  color: actif ? "#fff" : "#A9C2BB",
                  background: actif ? "rgba(255,255,255,0.12)" : "transparent",
                  fontWeight: actif ? 600 : 400,
                  borderLeft: actif ? `3px solid ${ACCENT}` : "3px solid transparent",
                }}
              >
                <Icon color={actif ? ACCENT : "#A9C2BB"} />
                <span className="nav-label">{l.label}</span>
              </Link>
              {l.children && actif && (
                <div className="nav-souslabel" style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2, marginBottom: 2 }}>
                  {l.children.map((c) => {
                    const sousActif = pathname === c.href;
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        style={{
                          padding: "7px 12px 7px 42px",
                          fontSize: 12.5, textDecoration: "none",
                          color: sousActif ? "#fff" : "#7A9C93",
                          background: sousActif ? "rgba(255,255,255,0.08)" : "transparent",
                          fontWeight: sousActif ? 600 : 400,
                          borderRadius: 6,
                        }}
                      >
                        {c.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={logout}
          title="Déconnexion"
          style={{
            width: "100%", fontSize: 13, border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "#A9C2BB", padding: "9px 12px",
            borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <IconLogout />
          <span className="nav-label">Déconnexion</span>
        </button>
        <p className="nav-footer" style={{ fontSize: 10.5, color: "#7A9C93", textAlign: "center", marginTop: 12, marginBottom: 0 }}>
          Créé par Judicaël Randrianaivo
        </p>
      </div>
    </div>
  );
}

function IconBase({ children }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}
function IconGrid({ color }) {
  return <IconBase><rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke={color} /></IconBase>;
}
function IconFile({ color }) {
  return <IconBase><path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke={color} /><path d="M9 12h6M9 16h6" stroke={color} /></IconBase>;
}
function IconCart({ color }) {
  return <IconBase><circle cx="9" cy="20" r="1.4" stroke={color} /><circle cx="18" cy="20" r="1.4" stroke={color} /><path d="M2 3h2l2.4 12.4a1.8 1.8 0 0 0 1.8 1.6h9.2a1.8 1.8 0 0 0 1.8-1.5L21 8H6" stroke={color} /></IconBase>;
}
function IconClock({ color }) {
  return <IconBase><circle cx="12" cy="12" r="9" stroke={color} /><path d="M12 7v5l3.5 2" stroke={color} /></IconBase>;
}
function IconChart({ color }) {
  return <IconBase><path d="M4 20V10M12 20V4M20 20v-7" stroke={color} /></IconBase>;
}
function IconTruck({ color }) {
  return <IconBase><rect x="1" y="6" width="13" height="11" rx="1.2" stroke={color} /><path d="M14 10h4l3 3v4h-7z" stroke={color} /><circle cx="6" cy="19" r="1.6" stroke={color} /><circle cx="17" cy="19" r="1.6" stroke={color} /></IconBase>;
}
function IconBox({ color }) {
  return <IconBase><path d="M3 8l9-5 9 5-9 5-9-5z" stroke={color} /><path d="M3 8v9l9 5 9-5V8" stroke={color} /><path d="M12 13v9" stroke={color} /></IconBase>;
}
function IconList({ color }) {
  return <IconBase><path d="M8 6h13M8 12h13M8 18h13" stroke={color} /><circle cx="3.5" cy="6" r="1.2" fill={color} stroke="none" /><circle cx="3.5" cy="12" r="1.2" fill={color} stroke="none" /><circle cx="3.5" cy="18" r="1.2" fill={color} stroke="none" /></IconBase>;
}
function IconSave({ color }) {
  return <IconBase><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke={color} /><path d="M17 21v-8H7v8M7 3v5h8" stroke={color} /></IconBase>;
}
function IconLogout() {
  return <IconBase><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#A9C2BB" /><path d="M16 17l5-5-5-5M21 12H9" stroke="#A9C2BB" /></IconBase>;
}
