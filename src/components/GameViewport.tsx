import type { ReactNode } from "react";

interface GameViewportProps {
  children: ReactNode;
  accent?: string;
}

export default function GameViewport({ children, accent = "var(--phosphor)" }: GameViewportProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full h-full p-0 md:p-4 lg:p-8"
         style={{ ["--cabinet-accent" as string]: accent }}>
      <div 
        className="w-full h-full flex flex-col relative 
                   md:max-w-[850px] md:max-h-[850px] 
                   md:border-[3px] md:rounded-[6px_14px_10px_8px] md:bg-surface
                   md:shadow-[0_0_20px_-5px_var(--cabinet-accent)]
                   overflow-hidden transition-all"
        style={{
          borderColor: "color-mix(in srgb, var(--cabinet-accent) 40%, var(--color-border))"
        }}
      >
        <div className="hidden md:block absolute inset-0 pointer-events-none opacity-[0.03]" 
             style={{
               backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
               backgroundSize: "128px 128px"
             }} 
        />
        <div className="flex-1 flex flex-col relative z-10 w-full h-full overflow-hidden bg-background md:bg-transparent">
          {children}
        </div>
      </div>
    </div>
  );
}
