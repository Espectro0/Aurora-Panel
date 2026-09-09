"use client";

type NavItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type HeaderProps = {
  activeLabel?: string;
  items?: NavItem[];
};

const DEFAULT_ITEMS: NavItem[] = [{ label: "Inicio" }];

export default function Header({
  activeLabel = "Inicio",
  items = DEFAULT_ITEMS,
}: HeaderProps) {
  return (
    <header className="pointer-events-auto sticky top-0 z-30 flex w-full items-center justify-between border-b border-[#39ff1444] bg-black/80 px-5 py-3 font-mono">
      <span
        className="text-sm tracking-[0.25em] text-[#39ff14]"
        style={{ textShadow: "0 0 10px #39ff14aa" }}
      >
        AURORA PANEL
      </span>

      <nav className="flex items-center gap-2">
        {items.map((item) => {
          const isActive = item.label === activeLabel;
          const content = (
            <span
              className={`rounded border px-3 py-1 text-xs transition-colors ${
                isActive
                  ? "border-[#39ff14aa] bg-[#39ff1422] text-[#39ff14]"
                  : "border-[#39ff1444] text-[#5fae7a] hover:bg-[#39ff1411] hover:text-[#39ff14]"
              }`}
            >
              {item.label}
            </span>
          );

          if (item.href) {
            return (
              <a key={item.label} href={item.href}>
                {content}
              </a>
            );
          }

          return (
            <button key={item.label} onClick={item.onClick}>
              {content}
            </button>
          );
        })}
      </nav>
    </header>
  );
}