import type { SVGProps } from "react";

// Minimal inline icon set (stroke-based, currentColor). No dependency.
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconUsers(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 20v-1a4 4 0 0 0-3-3.87M16 4.1A4 4 0 0 1 16 11.9" />
    </svg>
  );
}
export function IconSend(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}
export function IconMegaphone(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M3 11v2a1 1 0 0 0 1 1h3l4 3.5V6.5L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 8a5 5 0 0 1 0 8" />
      <path d="M18 5a9 9 0 0 1 0 14" />
    </svg>
  );
}
export function IconTag(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M20.6 13.4 12.4 21.6a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 2 13.2V4a2 2 0 0 1 2-2h9.2a2 2 0 0 1 1.4.6l6 6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.4" />
    </svg>
  );
}
export function IconCheck(p: SVGProps<SVGSVGElement>) {
  return (<svg {...base} {...p}><path d="M20 6 9 17l-5-5" /></svg>);
}
export function IconCoin(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.7c0 2.3-5 1.3-5 3.6 0 1.1 1 1.7 2.5 1.7s2.5-.5 2.5-1.5" />
    </svg>
  );
}
export function IconInbox(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7z" />
    </svg>
  );
}
