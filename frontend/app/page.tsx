import Envelope from "./components/Envelope";
import Header from "./components/Header";
import HomeDesk from "./components/HomeDesk";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-14 px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
        <Envelope />
        <HomeDesk />
      </main>
    </div>
  );
}
