"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Renvoie l'id (uuid) de l'utilisateur connecté, ou null tant que ce n'est pas encore chargé.
export function useUserId() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id || null);
    })();
  }, []);

  return userId;
}

