"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { FloorPlan, Room } from "@imora/shared";
import { cn } from "@/lib/cn";

export interface FloorPlan2DHandle {
  /** Rotate the camera cone (called every frame from the viewer, no React re-render). */
  setHeading: (yawDeg: number) => void;
}

/**
 * Interactive architectural plan. Rooms are laid out from their normalized plan_rect.
 * The active room shows the synchronized camera cone; clicking a room moves the viewer there.
 */
export const FloorPlan2D = forwardRef<FloorPlan2DHandle, {
  plan: FloorPlan;
  rooms: Room[];
  activeRoomId: string | null;
  roomsWithScene: Set<string>;
  onSelect: (room: Room) => void;
  labelFor: (room: Room) => string;
  activeLabel: string;
  showDimensions?: boolean;
  className?: string;
}>(function FloorPlan2D({ plan, rooms, activeRoomId, roomsWithScene, onSelect, labelFor, activeLabel, showDimensions, className }, ref) {
  const cone = useRef<SVGGElement>(null);
  const W = plan.width_m ?? 20;
  const D = plan.depth_m ?? 12;
  const scale = 1000 / W; // SVG units
  const H = D * scale;

  useImperativeHandle(ref, () => ({
    setHeading: (yaw) => {
      // Plan "up" = panorama yaw 0 (north offset can be added per scene later)
      cone.current?.setAttribute("transform", cone.current.dataset.base + ` rotate(${yaw})`);
    },
  }));

  const planRooms = rooms.filter((r) => r.floor_plan_id === plan.id && r.plan_rect);

  return (
    <div className={cn("relative rounded-2xl bg-surface-2 p-3", className)}>
      <svg viewBox={`-20 -20 ${1040} ${H + 40}`} className="h-auto w-full" role="group" aria-label={plan.name}>
        <rect x={-6} y={-6} width={1012} height={H + 12} rx={10} fill="var(--surface)" stroke="var(--line)" strokeWidth={6} />
        {planRooms.map((room) => {
          const [rx, ry, rw, rh] = room.plan_rect!;
          const x = rx * 1000, y = ry * H, w = rw * 1000, h = rh * H;
          const active = room.id === activeRoomId;
          const clickable = roomsWithScene.has(room.id);
          const isWater = room.room_type === "patio" || room.room_type === "pool";
          return (
            <g key={room.id} onClick={() => onSelect(room)} className={clickable ? "cursor-pointer" : "cursor-default"}
              role="button" tabIndex={0} aria-pressed={active} aria-label={labelFor(room)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(room)}>
              <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={6}
                fill={active ? "var(--gold-soft)" : isWater ? "color-mix(in srgb, #9cc9d9 22%, var(--surface))" : "var(--surface)"}
                stroke={active ? "var(--gold)" : "var(--line)"} strokeWidth={active ? 5 : 3}
                className="transition-[fill,stroke] duration-200 hover:fill-[var(--surface-2)]" />
              {(() => {
                // Scale labels to the room so they never overflow it
                const fs = Math.max(16, Math.min(30, (w - 24) / (Math.max(labelFor(room).length, 6) * 0.55)));
                return (
                  <>
                    <text x={x + w / 2} y={y + h / 2 - (active ? 34 : 4)} textAnchor="middle" className="fill-[var(--ink-2)]" style={{ font: `${active ? 600 : 500} ${fs}px var(--font-body), sans-serif` }}>
                      {isWater && "🌿 "}{labelFor(room)}
                    </text>
                    {active && activeLabel && (
                      <text x={x + w / 2} y={y + h / 2 - 34 + fs} textAnchor="middle" className="fill-[var(--ink-2)]" style={{ font: `500 ${fs * 0.8}px var(--font-body), sans-serif` }}>{activeLabel}</text>
                    )}
                    {(active || showDimensions) && (
                      <text x={x + w / 2} y={y + h / 2 + (active ? 52 : 32)} textAnchor="middle" className="fill-[var(--gold)]" style={{ font: `500 ${Math.min(24, fs * 0.85)}px var(--font-body), sans-serif` }}>
                        {showDimensions && room.length_m && room.width_m
                          ? `${room.length_m} × ${room.width_m} m`
                          : [room.area_m2 ? `${room.area_m2} m²` : null, room.material].filter(Boolean).join(" · ")}
                      </text>
                    )}
                  </>
                );
              })()}
              {active && (
                <g ref={cone} data-base={`translate(${x + w / 2} ${y + h / 2 + 22})`} transform={`translate(${x + w / 2} ${y + h / 2 + 22})`}>
                  <path d="M0 0 L-42 -95 A104 104 0 0 1 42 -95 Z" fill="var(--gold-bright)" opacity={0.28} />
                  <circle r={11} fill="var(--gold)" stroke="var(--surface)" strokeWidth={4} />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
});
