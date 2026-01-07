"use client";

import { Box } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateButtonProps {
  disabled: boolean;
  onClick: () => void;
}

export function GenerateButton({ disabled, onClick }: GenerateButtonProps) {
  return (
    <Button onClick={onClick} disabled={disabled} size="lg" className="w-full">
      <Box className="w-5 h-5 mr-2" />
      Generate STL
    </Button>
  );
}
