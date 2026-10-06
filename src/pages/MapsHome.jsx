import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Mountain } from "lucide-react";
import UploadMapDialog from "@/components/maps/UploadMapDialog";
import MapCard from "@/components/maps/MapCard";
import { useToast } from "@/components/ui/use-toast";

export default function MapsHome() {
  const [maps, setMaps] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const list = await base44.entities.TopoMap.list("-created_date", 50);
      setMaps(list);
    } catch {
      setMaps([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id) => {
    await base44.entities.TopoMap.delete(id);
    toast({ title: "Map deleted" });
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Mountain className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-heading tracking-tight">
                Contour Extractor
              </h1>
              <p className="text-sm text-muted-foreground">
                Upload a scanned topographic map and extract its contour lines.
              </p>
            </div>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Upload map
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {maps === null ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : maps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Mountain className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium">No maps yet</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Upload a scanned topographic map to get started.
            </p>
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Upload your first map
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {maps.map((m) => (
              <MapCard key={m.id} map={m} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      <UploadMapDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSaved={() => {
          setUploadOpen(false);
          load();
        }}
      />
    </div>
  );
}