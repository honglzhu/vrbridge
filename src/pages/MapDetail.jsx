import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  ArrowLeft,
  Download,
  RefreshCw,
  Trash2,
  Save,
} from "lucide-react";
import ContourOverlay from "@/components/maps/ContourOverlay";
import { useToast } from "@/components/ui/use-toast";
import {
  loadImageFromSrc,
  extractContours,
  buildSvg,
  buildGeoJson,
  downloadFile,
} from "@/lib/contourExtractor";

export default function MapDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [map, setMap] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [contours, setContours] = useState([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [sensitivity, setSensitivity] = useState(50);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(async () => {
    const m = await base44.entities.TopoMap.get(id);
    setMap(m);
    setName(m.name);
    setContours(m.contours ? JSON.parse(m.contours) : []);
    setSensitivity(m.threshold ?? 50);
    const res = await base44.integrations.Core.CreateFileSignedUrl({
      file_uri: m.image_uri,
    });
    setImageUrl(res.signed_url);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const reExtract = async () => {
    if (!imageUrl) return;
    setBusy(true);
    try {
      const img = await loadImageFromSrc(imageUrl);
      const { width, height, contours: cs, contour_count } = extractContours(
        img,
        sensitivity
      );
      const updated = await base44.entities.TopoMap.update(id, {
        contours: JSON.stringify(cs),
        contour_count,
        width,
        height,
        threshold: sensitivity,
      });
      setMap(updated);
      setContours(cs);
      toast({
        title: "Contours re-extracted",
        description: `${contour_count} contour lines found.`,
      });
    } catch (e) {
      toast({
        title: "Re-extraction failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    setSavingName(true);
    try {
      const updated = await base44.entities.TopoMap.update(id, { name });
      setMap(updated);
      toast({ title: "Name updated" });
    } finally {
      setSavingName(false);
    }
  };

  const exportSvg = () => {
    const svg = buildSvg(contours, map.width, map.height);
    downloadFile(`${map.name || "contours"}.svg`, svg, "image/svg+xml");
  };

  const exportGeoJson = () => {
    const gj = buildGeoJson(contours, map.height);
    downloadFile(
      `${map.name || "contours"}.geojson`,
      JSON.stringify(gj),
      "application/geo+json"
    );
  };

  const handleDelete = async () => {
    await base44.entities.TopoMap.delete(id);
    toast({ title: "Map deleted" });
    navigate("/");
  };

  if (!map) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-medium truncate">{map.name}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ContourOverlay
              imageUrl={imageUrl}
              contours={contours}
              width={map.width}
              height={map.height}
              showOverlay={showOverlay}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {map.contour_count ?? 0} contour lines · {map.width}×{map.height}px
              · extracted at sensitivity {map.threshold ?? 50}
            </p>
          </div>

          <div className="space-y-6">
            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Overlay
              </h2>
              <div className="flex items-center justify-between">
                <Label htmlFor="overlay-toggle">Show contours</Label>
                <Switch
                  id="overlay-toggle"
                  checked={showOverlay}
                  onCheckedChange={setShowOverlay}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Re-extract
              </h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Sensitivity</Label>
                  <span className="text-sm text-muted-foreground">
                    {sensitivity}
                  </span>
                </div>
                <Slider
                  value={[sensitivity]}
                  onValueChange={(v) => setSensitivity(v[0])}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <Button
                onClick={reExtract}
                disabled={busy}
                variant="secondary"
                className="w-full"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Re-extract contours
                  </>
                )}
              </Button>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Export
              </h2>
              <Button onClick={exportSvg} variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download SVG
              </Button>
              <Button
                onClick={exportGeoJson}
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download GeoJSON
              </Button>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Details
              </h2>
              <div className="flex gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <Button
                  onClick={saveName}
                  disabled={savingName || name === map.name}
                  variant="secondary"
                >
                  {savingName ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <Button
                onClick={handleDelete}
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete map
              </Button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}