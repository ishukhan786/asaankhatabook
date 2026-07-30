import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number; // Size of the logo icon in pixels
  showText?: boolean;
  textClassName?: string;
}

export function AsaanKhataLogo({
  className,
  size = 40,
  showText = false,
  textClassName,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      {/* Brand Icon SVG Wrapper */}
      <div 
        className="relative shrink-0 flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 220 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="akGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            
            <filter id="akIconShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* SVG Icon Paths matching the new logo */}
          <g filter="url(#akIconShadow)">
            {/* The outer arch of the 'A' */}
            <path
              d="M 60,155 C 60,125 78,45 110,45 C 142,45 160,125 160,155"
              fill="none"
              stroke="url(#akGreenGrad)"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Bottom Swoosh */}
            <path
              d="M 85,152 C 105,170 145,165 185,115"
              fill="none"
              stroke="url(#akGreenGrad)"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* 3 Chart Bars */}
            <rect x="92" y="110" width="10" height="25" rx="2" fill="url(#akGreenGrad)" />
            <rect x="108" y="95" width="10" height="40" rx="2" fill="url(#akGreenGrad)" />
            <rect x="124" y="80" width="10" height="55" rx="2" fill="url(#akGreenGrad)" />
          </g>
        </svg>
      </div>

      {/* Brand Text Elements (Responsive to Light/Dark Mode) */}
      {showText && (
        <div className="flex flex-col select-none">
          <div className="flex items-baseline">
            <span 
              className={cn(
                "font-display text-[21px] font-extrabold tracking-tight text-slate-800 dark:text-white leading-none",
                textClassName
              )}
            >
              Asaan
            </span>
            <span 
              className={cn(
                "font-display text-[21px] font-extrabold tracking-tight text-[#059669] dark:text-[#34D399] leading-none",
                textClassName
              )}
            >
              Khata
            </span>
          </div>
          <span className="text-[7.2px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400 mt-1.5 flex items-center gap-1">
            <span className="h-px w-2 bg-slate-400/40" />
            Smart Accounting, Simplified
            <span className="h-px w-2 bg-slate-400/40" />
          </span>
        </div>
      )}
    </div>
  );
}


