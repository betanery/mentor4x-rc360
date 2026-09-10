import { createRoot } from "react-dom/client";
import "./index.css";
import { BootError } from "./components/BootError";

const root = createRoot(document.getElementById("root")!);

const missing = [
  ["VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL],
  ["VITE_SUPABASE_PUBLISHABLE_KEY", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY],
].filter(([, value]) => !value).map(([name]) => name as string);

if (missing.length) {
  // Build publicado sem as variáveis do backend: mostra aviso em vez de tela branca.
  root.render(<BootError detail={`Configuração ausente: ${missing.join(", ")}`} />);
} else {
  import("./App")
    .then(({ default: App }) => root.render(<App />))
    .catch((error: unknown) => {
      console.error("Falha ao iniciar o Mentor 4X", error);
      root.render(<BootError detail={error instanceof Error ? error.message : undefined} />);
    });
}
