"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Box } from "lucide-react";

interface GenerateButtonProps {
  disabled: boolean;
  onClick: () => void;
}

export function GenerateButton({ disabled, onClick }: GenerateButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="lg"
      className="w-full"
    >
      <Box className="w-5 h-5 mr-2" />
      Generate STL
    </Button>
  );
}
