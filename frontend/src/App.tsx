import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import Docs from "./pages/Docs";
import { AppShell } from "./components/ui/AppShell";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </AppShell>
  );
}
