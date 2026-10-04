import Header from "../components/Header";
import JournalBook from "../components/JournalBook";

export default function JournalPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col">
        <JournalBook />
      </main>
    </div>
  );
}
