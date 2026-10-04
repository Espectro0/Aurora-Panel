import Header from "../components/Header";
import VoiceDesk from "../components/VoiceDesk";

export default function VoicePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col">
        <VoiceDesk />
      </main>
    </div>
  );
}
