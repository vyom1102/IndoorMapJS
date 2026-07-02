import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import IndoorMap from "./components/IndoorMap";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<IndoorMap />} />
        <Route path="/:venueName" element={<IndoorMap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
