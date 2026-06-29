import { create } from "zustand";
import { UserProfile } from "../types/index";
import { api } from "../services/api";
import { googleSignIn, googleSignOut, initAuth, anonymousSignIn } from "../services/firebase.ts";

interface UserState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  authInitialized: boolean;
  loading: boolean;
  error: string | null;

  loginWithGoogle: (email?: string, fullName?: string, avatarUrl?: string) => Promise<void>;
  loginBypass: (email: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useUserStore = create<UserState>((set, get) => {
  // Load initial session on startup
  const storedUser = localStorage.getItem("crunch_user");
  const storedToken = localStorage.getItem("crunch_token");

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken || null,
    isAuthenticated: !!storedToken,
    authInitialized: false,
    loading: false,
    error: null,

    loginWithGoogle: async (fallbackEmail, fallbackName, fallbackAvatar) => {
      set({ loading: true, error: null });
      try {
        let email = fallbackEmail;
        let fullName = fallbackName;
        let avatarUrl = fallbackAvatar;
        let idToken = "";
        let fbResult = null;

        // Trigger real Firebase Sign In with Google
        try {
          fbResult = await googleSignIn();
          if (fbResult) {
            email = fbResult.user.email || undefined;
            fullName = fbResult.user.displayName || undefined;
            avatarUrl = fbResult.user.photoURL || undefined;
            idToken = fbResult.idToken;
          }
        } catch (authErr: any) {
          console.warn("Real Google Auth failed or was cancelled:", authErr);
          // If we have a fallback email, we can use it, otherwise rethrow the original error
          if (fallbackEmail) {
            console.log("Using fallback/bypass demo authentication...");
            try {
              fbResult = await anonymousSignIn();
            } catch (anonErr) {
              console.error("Firebase Anonymous sign-in failed:", anonErr);
            }
          } else {
            throw authErr;
          }
        }

        if (!email) {
          throw new Error("No email returned from Google authentication");
        }

        // Exchange Firebase ID Token or credentials for backend session JWT & PostgreSQL profile sync
        const response = await api.post("/api/v1/auth/google", {
          email,
          fullName,
          avatarUrl,
          idToken,
          firebaseUid: fbResult?.user?.uid || `demo-${email.replace(/[^a-zA-Z0-9]/g, "-")}`
        });

        const { user, token } = response.data;

        localStorage.setItem("crunch_user", JSON.stringify(user));
        localStorage.setItem("crunch_token", token);

        set({
          user,
          token,
          isAuthenticated: true,
          loading: false
        });
      } catch (err: any) {
        console.error("Auth store error during Google Sign In:", err);
        set({ 
          error: err.response?.data?.error || err.message || "Authentication failed", 
          loading: false 
        });
        throw err;
      }
    },

    loginBypass: async (email, fullName) => {
      set({ loading: true, error: null });
      try {
        const name = fullName || email.split("@")[0];
        const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(name)}`;
        const firebaseUid = `demo-${email.replace(/[^a-zA-Z0-9]/g, "-")}`;

        const response = await api.post("/api/v1/auth/google", {
          email,
          fullName: name,
          avatarUrl,
          idToken: "",
          firebaseUid
        });

        const { user, token } = response.data;

        localStorage.setItem("crunch_user", JSON.stringify(user));
        localStorage.setItem("crunch_token", token);

        set({
          user,
          token,
          isAuthenticated: true,
          loading: false
        });
      } catch (err: any) {
        console.error("Bypass login failed:", err);
        set({
          error: err.response?.data?.error || err.message || "Bypass login failed",
          loading: false
        });
        throw err;
      }
    },

    logout: async () => {
      try {
        await googleSignOut();
      } catch (err) {
        console.error("Firebase sign out error:", err);
      }
      localStorage.removeItem("crunch_user");
      localStorage.removeItem("crunch_token");
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        authInitialized: false,
        error: null
      });
    },

    initializeAuth: () => {
      initAuth(
        async (user, googleAccessToken) => {
          console.log("Firebase Auth detected persistent login for:", user.email);
          
          const storedUserStr = localStorage.getItem("crunch_user");
          const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
          
          if (!storedUser || storedUser.id !== user.uid) {
            console.log("User session out of sync, re-syncing with backend...");
            try {
              const response = await api.post("/api/v1/auth/google", {
                email: user.email || storedUser?.email || "academic.warrior@gmail.com",
                fullName: user.displayName || storedUser?.fullName || "Alex Mercer",
                avatarUrl: user.photoURL || storedUser?.avatarUrl || "https://api.dicebear.com/7.x/pixel-art/svg?seed=Alex",
                idToken: googleAccessToken || "",
                firebaseUid: user.uid
              });
              const { user: syncedUser, token } = response.data;
              localStorage.setItem("crunch_user", JSON.stringify(syncedUser));
              localStorage.setItem("crunch_token", token);
              set({ user: syncedUser, token, isAuthenticated: true, authInitialized: true });
              return;
            } catch (err) {
              console.error("Failed to re-sync user with backend:", err);
            }
          }
          set({ isAuthenticated: true, authInitialized: true });
        },
        () => {
          console.log("No persistent Firebase user session active.");
          localStorage.removeItem("crunch_user");
          localStorage.removeItem("crunch_token");
          set({ user: null, token: null, isAuthenticated: false, authInitialized: true });
        }
      );
    },

    setError: (error) => set({ error }),
    clearError: () => set({ error: null })
  };
});
