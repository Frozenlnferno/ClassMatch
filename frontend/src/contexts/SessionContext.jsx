/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase.js";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error("[auth.getSession]", error);
      }
      setSession(data.session ?? null);
      setIsSessionLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(Boolean(nextSession));
      } else if (event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
      }
      setIsSessionLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    accessToken: session?.access_token ?? null,
    isSessionLoading,
    isPasswordRecovery,
    clearPasswordRecovery: () => setIsPasswordRecovery(false),
  }), [isPasswordRecovery, isSessionLoading, session]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}
