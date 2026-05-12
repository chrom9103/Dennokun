import React from "react";

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function Icon({
  name,
  className = "",
  size = 24,
}: IconProps) {
  return (
    <span
      className={`material-icons-outlined select-none inline-flex items-center justify-center ${className}`}
      style={{ fontSize: size, width: size, height: size }}
    >
      {name}
    </span>
  );
}
