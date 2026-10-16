import { useId } from "react";

interface Node {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  path?: boolean;
  root?: boolean;
}

const NODES: Node[] = [
  { id: "root", x: 480, y: 210, w: 176, h: 68, path: true, root: true },
  { id: "dc", x: 480, y: 452, w: 168, h: 64, path: true, root: true },
  { id: "file", x: 290, y: 604, w: 140, h: 56 },
  { id: "sql", x: 480, y: 604, w: 140, h: 56, path: true },
  { id: "ca", x: 670, y: 604, w: 140, h: 56 },
  { id: "ws1", x: 222, y: 770, w: 112, h: 48 },
  { id: "ws2", x: 358, y: 770, w: 112, h: 48 },
  { id: "ws3", x: 602, y: 770, w: 112, h: 48 },
  { id: "ws4", x: 738, y: 770, w: 112, h: 48 },
  { id: "web", x: 480, y: 962, w: 140, h: 56, path: true },
];

const EDGES = [
  "M290 576V452H396",
  "M670 576V452H564",
  "M222 746V700H358V746",
  "M290 700V632",
  "M602 746V700H738V746",
  "M670 700V632",
];

const PATH_EDGES = ["M480 934V632", "M480 576V484", "M296 962H410"];

function HostNode({ n }: { n: Node }) {
  const left = n.x - n.w / 2;
  const top = n.y - n.h / 2;
  const icon = n.h >= 60 ? 16 : 14;
  return (
    <g className={n.path ? "au-art__node is-path" : "au-art__node"}>
      <rect x={left} y={top} width={n.w} height={n.h} rx={8} />
      <rect className="au-art__icon" x={left + 14} y={n.y - icon / 2} width={icon} height={icon} rx={3} />
      <rect className="au-art__bar" x={left + 14 + icon + 12} y={n.y - 7} width={n.w * 0.42} height={5} rx={1} />
      <rect className="au-art__bar is-dim" x={left + 14 + icon + 12} y={n.y + 3} width={n.w * 0.26} height={4} rx={1} />
      <circle className="au-art__dot" cx={left + n.w - 14} cy={top + 14} r={3} />
      {n.root && <rect className="au-art__bar is-dim" x={left + n.w - 34} y={n.y + 10} width={20} height={4} rx={1} />}
    </g>
  );
}

export function AuthArt() {
  const gid = useId().replace(/:/g, "");
  return (
    <svg className="au-art__svg" viewBox="0 0 960 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`au-grid-${gid}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" className="au-art__grid" />
        </pattern>
      </defs>
      <rect width="960" height="1080" className="au-art__bg" />
      <rect width="960" height="1080" fill={`url(#au-grid-${gid})`} />

      <rect className="au-art__zone" x="280" y="120" width="400" height="180" rx="16" />
      <rect className="au-art__zone" x="140" y="380" width="680" height="470" rx="16" />
      <rect className="au-art__zone is-edge" x="360" y="900" width="240" height="124" rx="16" />

      <g className="au-art__edges">
        {EDGES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path className="au-art__trust" d="M480 420V244" />
      <g className="au-art__path">
        {PATH_EDGES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {NODES.map((n) => (
        <HostNode key={n.id} n={n} />
      ))}

      <g className="au-art__node is-path is-attacker">
        <rect x="184" y="938" width="112" height="48" rx="8" />
        <path className="au-art__glyph" d="M204 955l7 7-7 7M216 969h12" />
        <rect className="au-art__bar is-dim" x="240" y="960" width="36" height="4" rx="1" />
      </g>

      {[
        [480, 934],
        [480, 576],
        [410, 962],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} className="au-art__port" x={x - 3} y={y - 3} width="6" height="6" rx="1" />
      ))}
    </svg>
  );
}
