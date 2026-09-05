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
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Nav />
      <div style={{ flex: 1, padding: "28px 32px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>{children}</div>
    </div>
  );
}
