import React from "react";
import { cn } from "@/lib/utils";

interface WizardLayoutProps {
  currentStep: number;
  children: React.ReactNode;
  className?: string;
}

export function WizardLayout({
  currentStep,
  children,
  className,
}: WizardLayoutProps) {
  return (
    <div className={cn("min-h-screen flex flex-col", className)}>
      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
