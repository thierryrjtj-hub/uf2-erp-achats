"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Renvoie "acheteur" (accès complet) ou "invite" (droits restreints, pas de suppression),
// null tant que le rôle n'est pas encore chargé.
export function useRole() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) { setRole("acheteur"); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
      setRole(data?.role || "acheteur");
    })();
  }, []);

  return role;
}

