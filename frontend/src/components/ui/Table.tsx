import React, { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className={`w-full overflow-x-auto border border-border rounded-lg ${className}`}>
      <table className="w-full text-sm border-collapse">
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="bg-secondary">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="bg-white">{children}</tbody>;
}

export function TableRow({ children, className = "", hover = true }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <tr className={`border-t border-border ${hover ? "hover:bg-muted/30 transition-colors" : ""} ${className}`}>
      {children}
    </tr>
  );
}

export function TableHead({ 
  children, 
  className = "", 
  align = "left",
  ...props 
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "center" | "right" }) {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <th 
      className={`px-4 py-3 font-medium text-foreground ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ 
  children, 
  className = "", 
  align = "left",
  ...props 
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "center" | "right" }) {
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <td 
      className={`px-4 py-3 text-foreground ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}
