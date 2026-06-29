import { createContext, useContext } from "react";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  full_name: string | null;
}

interface AuthCtx {
  user: { id: string; email: string } | null;
  session: null;
  profile: Profile | null;
  isAdmin: boolean;
  userDepartment: string | null;
  profileFetched: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const DEMO_USER = { id: "demo", email: "demo@dashboard.com" };
const DEMO_PROFILE: Profile = { display_name: "Demo", avatar_url: null, full_name: "Demo User" };

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={{
      user: DEMO_USER,
      session: null,
      profile: DEMO_PROFILE,
      isAdmin: true,
      userDepartment: null,
      profileFetched: true,
      loading: false,
      signIn: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
      signOut: async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
