import SteamTableCalculator from "@/components/SteamTableCalculator";
import SeawaterPropertyCalculator from "@/components/SeawaterPropertyCalculator";
import PipeFlowCalculator from "@/components/PipeFlowCalculator";
import { Toaster } from "react-hot-toast";

export default function Home() {
  return (
    <main className="min-h-screen p-4 space-y-4 bg-gray-200">
      <div className="max-w-4xl mx-auto space-y-4">
        <SteamTableCalculator />
        <SeawaterPropertyCalculator />
        <PipeFlowCalculator />
      </div>
      <Toaster position="top-center" />
    </main>
  );
}
