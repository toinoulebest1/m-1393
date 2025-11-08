import { Layout } from "@/components/Layout";
import { BlindTestGame } from "@/components/games/BlindTestGame";
import { Gamepad2 } from "lucide-react";

const BlindTest = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold flex items-center gap-2 mb-8">
            <Gamepad2 className="w-8 h-8 text-primary" />
            Blind Test
          </h1>
          <BlindTestGame />
        </div>
      </div>
    </Layout>
  );
};

export default BlindTest;