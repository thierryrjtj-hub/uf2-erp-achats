"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const LINKS = [
  { href: "/dashboard", label: "Tableau de bord", icon: IconGrid },
  { href: "/demandes", label: "Demandes & TCO", icon: IconFile },
  { href: "/commandes", label: "Bons de commande", icon: IconCart },
  { href: "/historique", label: "Historique", icon: IconClock },
  { href: "/kpi", label: "KPI", icon: IconChart },
  { href: "/fournisseurs", label: "Fournisseurs", icon: IconTruck },
  { href: "/articles", label: "Articles", icon: IconBox },
  { href: "/journal", label: "Journal d'audit", icon: IconList },
];

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div style={{ width: 220, height: "100vh", background: "#1B2430", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 18px 16px" }}>
        <img src="/logo-hv.png" alt="UNIFOODS" style={{ height: 26, filter: "brightness(0) invert(1)" }} />
      </div>

      <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {LINKS.map((l) => {
          const actif = pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8,
                fontSize: 13.5, textDecoration: "none",
                color: actif ? "#fff" : "#9AA4B2",
                background: actif ? "rgba(255,255,255,0.10)" : "transparent",
                fontWeight: actif ? 600 : 400,
              }}
            >
              <Icon color={actif ? "#fff" : "#9AA4B2"} />
              {l.label}
            </Link>
          );
        })}
      </div>

      <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={logout}
          style={{
            width: "100%", fontSize: 13, border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "#9AA4B2", padding: "9px 12px",
            borderRadius: 8, cursor: "pointer",
          }}
        >
          Déconnexion
        </button>
        <p style={{ fontSize: 10.5, color: "#5C6672", textAlign: "center", marginTop: 12, marginBottom: 0 }}>
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
