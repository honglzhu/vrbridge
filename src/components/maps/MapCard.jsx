import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Trash2 } from "lucide-react";

export default function MapCard({ map, onDelete }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await base44.integrations.Core.CreateFileSignedUrl({
          file_uri: map.image_uri,
        });
        if (active) setUrl(res.signed_url);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [map.image_uri]);

  return (
    <div className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
      <Link
        to={`/maps/${map.id}`}
        className="block aspect-[4/3] bg-muted relative"
      >
        {url ? (
          <img
            src={url}
            alt={map.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/maps/${map.id}`}
            className="font-medium hover:underline truncate"
          >
            {map.name}
          </Link>
          <button
            onClick={() => onDelete(map.id)}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            aria-label="Delete map"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {map.contour_count ?? 0} contour lines · {map.width}×{map.height}
        </p>
      </div>
    </div>
  );
}