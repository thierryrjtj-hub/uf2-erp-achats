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
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Nav />
      <div style={{ flex: 1, height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="content-pane" style={{ flex: 1, minHeight: 0, padding: "20px 32px 24px", maxWidth: 1400, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", overflow: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
