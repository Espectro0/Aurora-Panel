import Header from "../components/Header";
import GraphView from "../components/GraphView";

export default function MemoriaPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        activeLabel="Home"
        items={[
          { label: "Home", href: "/" }
        ]}
      />
      <div className="flex-1 overflow-hidden">
        <GraphView />
      </div>
    </div>
  );
}
