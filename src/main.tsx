import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import ErrorBoundary from "./components/ErrorBoundary";
import { ClerkProvider } from "@clerk/clerk-react";

// Read the Clerk key from the environment
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  console.error("Missing Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY || "missing"}
      signInUrl="/#/auth"
      signUpUrl="/#/auth/sign-up"
      afterSignInUrl="/#/"
      afterSignUpUrl="/#/"
    >
      <App />
    </ClerkProvider>
  </ErrorBoundary>
);
