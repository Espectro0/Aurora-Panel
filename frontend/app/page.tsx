import Header from "./components/Header";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-[#39ff14]">
      <Header
        activeLabel=""
        items={[]}
      />

      <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8 font-mono">
        {/* System Status Badge */}
        <div className="mb-4 flex items-center gap-2 rounded-full border border-[#39ff1433] bg-[#39ff1410] px-3 py-1 text-xs tracking-wider">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#39ff14] shadow-[0_0_8px_#39ff14]" />
          <span>SYSTEM: ONLINE // v1.2.0</span>
        </div>

        {/* Rounded Aurora Image Container */}
        <div className="relative mb-6 h-52 w-52 overflow-hidden rounded-3xl border border-[#39ff1444] shadow-[0_0_20px_rgba(57,255,20,0.15)] bg-black">
          <Image
            src="/aurora.png"
            alt="Aurora"
            fill
            sizes="208px"
            className="object-cover opacity-85 transition-transform duration-700 hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        </div>

        <h1
          className="text-3xl tracking-[0.3em] text-[#39ff14]"
          style={{
            textShadow:
              "0 0 12px #39ff14aa, 0 0 24px #39ff1455, 2px 2px 6px rgba(0,0,0,0.9)",
          }}
        >
          AURORA PANEL
        </h1>
        <p className="mt-2 max-w-lg text-center text-xs text-[#5fae7a]">
          Aurora is a persistent conversational agent with identity, memory, and evolving personality, living on Discord and Telegram.
        </p>

        {/* Quick Stats Bar */}
        <div className="mt-6 flex flex-wrap justify-center gap-4 border-y border-[#39ff1422] py-2 text-[11px] text-[#5fae7a]">
          <div>STACK: <span className="text-[#39ff14]">GO + QDRANT</span></div>
          <div>•</div>
          <div>MEMORY: <span className="text-[#39ff14]">VECTOR + GRAPH</span></div>
          <div>•</div>
          <div>LLM: <span className="text-[#39ff14]">OPENROUTER</span></div>
        </div>

        {/* Navigation Grid */}
        <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <a
            href="/mind"
            className="group relative rounded border border-[#39ff1444] bg-black/60 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#39ff14aa] hover:bg-[#39ff1411] hover:shadow-[0_0_15px_rgba(57,255,20,0.2)]"
          >
            <p className="text-sm uppercase tracking-widest text-[#39ff14] group-hover:brightness-125">
              Memory
            </p>
            <p className="mt-2 text-xs text-[#5fae7a]">
              Explore the memory graph: nodes, connections, and context.
            </p>
          </a>

          <div className="rounded border border-[#39ff1422] bg-black/30 p-5 opacity-50 backdrop-blur-sm">
            <p className="text-sm uppercase tracking-widest text-[#5fae7a]">
              Coming Soon
            </p>
            <p className="mt-2 text-xs text-[#5fae7a]">
              New modules will be added here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}