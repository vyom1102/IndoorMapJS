import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import IndoorMap from "./components/IndoorMap";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndoorMap />} />
        <Route path="/:venueName" element={<IndoorMap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
