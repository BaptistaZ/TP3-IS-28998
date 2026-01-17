import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import Docs from "./pages/Docs";

export default function App() {
  return (
    <div>
      <nav style={{ padding: 12, borderBottom: "1px solid #ddd", display: "flex", gap: 12 }}>
        <Link to="/">Dashboard</Link>
        <Link to="/incidents">Incidentes</Link>
        <Link to="/docs">Documentos</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </div>
  );
}
