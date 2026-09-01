"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const LINKS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/demandes", label: "Demandes & TCO" },
  { href: "/fournisseurs", label: "Fournisseurs" },
  { href: "/articles", label: "Articles" },
];

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: "#fff", borderBottom: "1px solid #eee" }}>
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <strong style={{ fontSize: 15 }}>UF2 - ERP Achats</strong>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontSize: 14,
              color: pathname.startsWith(l.href) ? "#1B2430" : "#888",
              fontWeight: pathname.startsWith(l.href) ? 600 : 400,
              textDecoration: "none",
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <button onClick={logout} style={{ fontSize: 13, border: "1px solid #ddd", background: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>
        Déconnexion
      </button>
    </div>
  );
}
