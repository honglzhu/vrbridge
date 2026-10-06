import React, { useMemo } from "react";

// Renders the original map image with the extracted contour polylines
// overlaid as an SVG. Both scale proportionally to the container.
export default function ContourOverlay({
  imageUrl,
  contours,
  width,
  height,
  showOverlay = true,
  overlayColor = "#ef4444",
}) {
  const pathD = useMemo(
    () =>
      (contours || [])
        .map(
          (pl) =>
            "M " + pl.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ")
        )
        .join(" "),
    [contours]
  );

  const strokeW = Math.max(1.2, width / 500);

  return (
    <div
      className="relative w-full bg-muted rounded-lg overflow-hidden border"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Topographic map"
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}
      {showOverlay && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <g
            fill="none"
            stroke={overlayColor}
            strokeOpacity="0.85"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={pathD} />
          </g>
        </svg>
      )}
    </div>
  );
}