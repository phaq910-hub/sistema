import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { TeamMember } from "@/lib/types";

const icon = (live: boolean, initials: string) =>
  L.divIcon({
    className: "tech-marker",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div style="position:relative;width:40px;height:40px;display:grid;place-items:center">
      ${live ? '<span style="position:absolute;inset:4px;border-radius:9999px;background:rgba(56,189,248,.45)" class="animate-radar"></span>' : ""}
      <span style="position:relative;width:30px;height:30px;border-radius:9999px;display:grid;place-items:center;font:700 11px sans-serif;color:#fff;background:${live ? "#0284C7" : "#475569"};border:2px solid #fff">${initials}</span>
    </div>`,
  });

function Fit({ members }: { members: TeamMember[] }) {
  const map = useMap();
  // Re-frame only when the set of located technicians changes, not on every GPS tick.
  const ids = members.map((m) => m.id).join();
  const pts = useMemo(
    () => members.filter((m) => m.last_location).map((m) => [m.last_location!.lat, m.last_location!.lng] as [number, number]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids],
  );
  useEffect(() => {
    if (pts.length === 1) map.setView(pts[0], 14);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15 });
  }, [map, pts]);
  return null;
}

export default function TeamMapView({ members, onSelect }: { members: TeamMember[]; onSelect: (m: TeamMember) => void }) {
  const located = members.filter((m) => m.last_location);
  return (
    <div className="size-full" data-testid="team-map">
    <MapContainer center={[-23.5505, -46.6333]} zoom={11} className="size-full" zoomControl={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" className="osm-dark-tiles" />
      {located.map((m) => (
        <Marker
          key={m.id}
          position={[m.last_location!.lat, m.last_location!.lng]}
          icon={icon(!!m.active_order_id, m.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}
          eventHandlers={{ click: () => onSelect(m) }}
        >
          <Tooltip direction="top" offset={[0, -18]}>{m.name}{m.active_order_number ? ` · OS #${m.active_order_number}` : ""}</Tooltip>
        </Marker>
      ))}
      <Fit members={located} />
    </MapContainer>
    </div>
  );
}
