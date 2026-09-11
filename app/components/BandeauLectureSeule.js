export default function BandeauLectureSeule({ nomCreateur }) {
  return (
    <div className="no-print" style={{
      display: "flex", alignItems: "center", gap: 8, background: "#FFF3D6", color: "#8A6100",
      borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13,
    }}>
      <span style={{ fontSize: 15 }}>🔒</span>
      <span>
        <strong>Lecture seule</strong> — {nomCreateur ? `créé par ${nomCreateur}` : "créé par quelqu'un d'autre"}.
        Tu peux consulter et imprimer, mais pas modifier ni faire avancer le traitement ici.
      </span>
    </div>
  );
}

