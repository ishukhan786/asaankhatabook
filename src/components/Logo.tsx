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
  size = 42,
  showText = false,
  textClassName,
}: LogoProps) {
  if (showText) {
    return (
      <div className={cn("flex items-center select-none py-0.5", className)}>
        <img 
          src="/Logo.png" 
          alt="AsaanKhata Logo" 
          className="h-10 w-auto object-contain" 
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center select-none", className)}>
      <img 
        src="/favicon.png" 
        alt="AsaanKhata Icon" 
        style={{ width: size, height: size }}
        className="object-contain rounded-xl shadow-inner border border-white/10" 
      />
    </div>
  );
}

