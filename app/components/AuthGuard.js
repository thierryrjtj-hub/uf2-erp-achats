"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import Nav from "./Nav";

export default function AuthGuard({ children }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
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

  if (!ready) return <p style={{ padding: 24 }}>Chargement...</p>;

  return (
    <div>
      <Nav />
      <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
