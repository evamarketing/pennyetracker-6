import { createFileRoute, Link } from "@tanstack/react-router";
import { GraphCanvas } from "@/components/marking/GraphCanvas";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/marking/ward")({
  component: WardMarking,
  head: () => ({ meta: [{ title: "Ward Marking" }] }),
});

function WardMarking() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/marking"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Ward Marking</h1>
      </div>
      <GraphCanvas
        cfg={{
          label: "Ward",
          nodesTable: "wards",
          edgesTable: "ward_connections",
          srcCol: "source_ward_id",
          tgtCol: "target_ward_id",
          parentRef: { key: "panchayath_id", label: "Panchayath", table: "panchayaths" },
          subtitle: (n) => (n.ward_number ? `Ward #${n.ward_number}` : null),
        }}
      />
    </main>
  );
}
