"use client";

import React, { useRef } from "react";
import Button from "@/components/ui/Button";

interface CsvImportButtonProps {
  onImport: (data: string[][]) => void;
  isLoading?: boolean;
  label?: string;
}

export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentValue += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentValue);
        currentValue = "";
      } else if (char === '\r' || char === '\n') {
        row.push(currentValue);
        currentValue = "";
        // Only push row if it contains some data
        if (row.some(val => val.trim().length > 0) || row.length > 1) {
          lines.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
      } else {
        currentValue += char;
      }
    }
  }
  if (currentValue || row.length > 0) {
    row.push(currentValue);
    if (row.some(val => val.trim().length > 0) || row.length > 1) {
      lines.push(row);
    }
  }
  return lines;
}

export default function CsvImportButton({
  onImport,
  isLoading,
  label = "CSVインポート",
}: CsvImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const rows = parseCSV(content);
      onImport(rows);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />
      <Button
        variant="outlined"
        icon="upload"
        onClick={() => fileInputRef.current?.click()}
        loading={isLoading}
      >
        {label}
      </Button>
    </>
  );
}
