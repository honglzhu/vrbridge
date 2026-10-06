import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Loader2, ImageIcon } from "lucide-react";
import { loadImageFromSrc, extractContours } from "@/lib/contourExtractor";

export default function UploadMapDialog({ open, onOpenChange, onSaved }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState("");
  const [sensitivity, setSensitivity] = useState(50);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const { toast } = useToast();

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setName("");
    setSensitivity(50);
    setStage("");
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ""));
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const process = async () => {
    if (!file) return;
    setBusy(true);
    try {
      setStage("Uploading map…");
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({
        file,
      });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri,
      });

      setStage("Extracting contours…");
      const img = await loadImageFromSrc(signed_url);
      const { width, height, contours, contour_count } = extractContours(
        img,
        sensitivity
      );

      await base44.entities.TopoMap.create({
        name: name || "Untitled map",
        image_uri: file_uri,
        width,
        height,
        contours: JSON.stringify(contours),
        contour_count,
        threshold: sensitivity,
      });

      toast({
        title: "Map saved",
        description: `${contour_count} contour lines extracted.`,
      });
      reset();
      onSaved();
    } catch (e) {
      toast({
        title: "Something went wrong",
        description: e.message || "Could not process the map.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload topographic map</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <label className="block">
            <div className="flex items-center justify-center w-full h-40 rounded-lg border-2 border-dashed border-border bg-muted/40 cursor-pointer hover:bg-muted transition-colors overflow-hidden">
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                  <span className="text-sm">Click to choose a scanned map</span>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPick}
            />
          </label>

          <div className="space-y-2">
            <Label htmlFor="map-name">Name</Label>
            <Input
              id="map-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled map"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Detection sensitivity</Label>
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
            <p className="text-xs text-muted-foreground">
              Higher picks up fainter lines but adds more noise. You can re-tune
              later.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={process} disabled={busy || !file}>
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {stage || "Processing…"}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Extract &amp; save
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}