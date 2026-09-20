import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Cualquier URL desconocida vuelve a la estación de búsqueda */}
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster position="bottom-right" />
    </>
  );
}
