import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/ui/AppShell";
import Dashboard from "./pages/Dashboard";
import Docs from "./pages/Docs";
import Incidents from "./pages/Incidents";

// =============================================================================
// App routes
// =============================================================================
// Defines the client-side routes and wraps every page with the shared layout
// (navigation, header, spacing, etc.) via <AppShell />.
export default function App() {
  return (
    <AppShell>
      <Routes>
        {/* Dashboard / overview */}
        <Route path="/" element={<Dashboard />} />

        {/* Incidents list + filters */}
        <Route path="/incidents" element={<Incidents />} />

        {/* Stored XML documents list */}
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </AppShell>
  );
}