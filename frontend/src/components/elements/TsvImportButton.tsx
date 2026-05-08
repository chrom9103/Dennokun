"use client";

import React, { useRef } from "react";
import Button from "@/components/ui/Button";

interface TsvImportButtonProps {
  onImport: (data: string[][]) => void;
  isLoading?: boolean;
  label?: string;
}

export default function TsvImportButton({
  onImport,
  isLoading,
  label = "TSVインポート",
}: TsvImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const rows = content.split(/\r?\n/).map((row) => row.split("\t"));
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
        accept=".tsv,.txt"
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
