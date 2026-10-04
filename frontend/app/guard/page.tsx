import GuardDesk from "../components/GuardDesk";
import Header from "../components/Header";

export default function GuardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col">
        <GuardDesk />
      </main>
    </div>
  );
}
