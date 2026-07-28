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
  size = 44,
  showText = false,
  textClassName,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3.5", className)}>
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
            <linearGradient id="akIconBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB"/>
              <stop offset="100%" stopColor="#1D4ED8"/>
            </linearGradient>

            <linearGradient id="akIconGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F8D66D"/>
              <stop offset="100%" stopColor="#C99700"/>
            </linearGradient>

            <filter id="akIconShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="10" stdDeviation="12" floodOpacity="0.18"/>
            </filter>
          </defs>

          {/* Icon Body */}
          <g filter="url(#akIconShadow)">
            <rect
              x="20"
              y="20"
              rx="36"
              ry="36"
              width="180"
              height="180"
              fill="url(#akIconBg)"
            />

            {/* Stylized A */}
            <path
              d="M65 145 L110 60 L155 145 M82 113 L138 113"
              fill="none"
              stroke="white"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* K */}
            <path
              d="M115 60 L115 145 M115 104 L155 60 M115 104 L160 145"
              fill="none"
              stroke="url(#akIconGold)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      {/* Brand Text Elements (Responsive to Light/Dark Mode) */}
      {showText && (
        <div className="flex flex-col select-none">
          <span 
            className={cn(
              "font-display text-[21px] font-bold tracking-tight text-slate-900 dark:text-white leading-none",
              textClassName
            )}
          >
            AsaanKhata
          </span>
          <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mt-1.5">
            MODERN ACCOUNTING PLATFORM
          </span>
          {/* Gold Accent line below text */}
          <div className="h-[3px] w-[50px] bg-gradient-to-r from-[#F8D66D] to-[#C99700] rounded-full mt-2" />
        </div>
      )}
    </div>
  );
}
