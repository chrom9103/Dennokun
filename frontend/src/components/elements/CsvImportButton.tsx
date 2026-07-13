"use client";

import React, { useRef } from "react";
import Button from "@/components/ui/Button";

interface CsvImportButtonProps {
  onImport: (data: string[][]) => void;
  isLoading?: boolean;
  label?: string;
}

function parseCsv(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: double quote inside quotes represents a single quote
        current += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      row.push(current);
      current = "";
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      row.push(current);
      result.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  // Push remaining elements if any
  if (row.length > 0 || current !== "") {
    row.push(current);
    result.push(row);
  }

  return result;
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
      const rows = parseCsv(content);
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
        accept=".csv"
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
