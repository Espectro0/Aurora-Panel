import Header from "../components/Header";
import GraphView from "../components/GraphView";

export default function MemoriaPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="relative flex-1 overflow-hidden">
        <GraphView />
      </div>
    </div>
  );
}
