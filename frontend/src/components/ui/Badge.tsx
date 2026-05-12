import React, { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "secondary" | "success" | "warning" | "info" | "destructive" | "outline";
  className?: string;
  dot?: boolean;
}

export default function Badge({
  children,
  variant = "default",
  className = "",
  dot = false,
}: BadgeProps) {
  const variants = {
    default: "bg-muted text-muted-foreground",
    secondary: "bg-secondary text-foreground border border-border",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-yellow-700",
    info: "bg-info-light text-info",
    destructive: "bg-red-50 text-destructive border border-red-100",
    outline: "border border-border text-muted-foreground bg-transparent",
  };

  const dotColors = {
    default: "bg-muted-foreground",
    secondary: "bg-foreground",
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-info",
    destructive: "bg-destructive",
    outline: "bg-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
