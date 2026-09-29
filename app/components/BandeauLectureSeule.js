"use client";
import { useLangue } from "../../lib/i18n";

export default function BandeauLectureSeule({ nomCreateur }) {
  const { t } = useLangue();
  return (
    <div className="no-print" style={{
      display: "flex", alignItems: "center", gap: 8, background: "#FFF3D6", color: "#8A6100",
      borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13,
    }}>
      <span style={{ fontSize: 15 }}>🔒</span>
      <span>
        <strong>{t("ls_titre")}</strong> — {nomCreateur ? t("ls_cree_par", { nom: nomCreateur }) : t("ls_cree_autre")}.
        {t("ls_aide")}
      </span>
    </div>
  );
}
