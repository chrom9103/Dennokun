import React, { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-[var(--shadow-sm)] border border-border ${onClick ? "cursor-pointer hover:shadow-[var(--shadow-md)] transition-shadow" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <div onClick={onClick} className={`p-5 border-b border-border ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 border-t border-border bg-muted/30 rounded-b-lg ${className}`}>{children}</div>;
}
