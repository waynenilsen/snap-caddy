"use client"

import * as React from "react"
import { useState } from "react"
import { SVGPreview } from "./SVGPreview"
import { PaddingControls } from "./PaddingControls"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Check, AlertCircle, X } from "lucide-react"

interface ReviewStepProps {
  svgContent: string
  pixelsPerMm: number
  onConfirm: (paddedSvg: string, padding: number) => void
}

export function ReviewStep({
  svgContent,
  pixelsPerMm,
  onConfirm,
}: ReviewStepProps) {
  const [padding, setPadding] = useState(2) // Default 2mm padding
  const [zoom, setZoom] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    try {
      // Clear any previous errors
      setError(null)

      // Validate SVG content
      if (!svgContent || svgContent.trim().length === 0) {
        setError("No SVG content available. Please go back and complete the previous steps.")
        return
      }

      // Apply padding to SVG
      const paddedSvg = applyPaddingToSvg(svgContent, padding, pixelsPerMm)

      // Validate the result
      if (!paddedSvg || paddedSvg.trim().length === 0) {
        setError("Failed to apply padding to the SVG. Please try again.")
        return
      }

      onConfirm(paddedSvg, padding)
    } catch (error) {
      console.error("Error confirming SVG:", error)
      setError("An error occurred while processing the SVG. Please try adjusting the padding or go back to the previous step.")
    }
  }

  const handleDismissError = () => {
    setError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        {/* Title Section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Review Extracted Outline</h1>
          <p className="text-muted-foreground">
            Preview the extracted SVG outline and adjust padding as needed
          </p>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SVG Preview - takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <SVGPreview
              svgContent={svgContent}
              pixelsPerMm={pixelsPerMm}
              zoom={zoom}
              onZoomChange={setZoom}
              showGrid={true}
              gridSize={10}
            />
          </div>

          {/* Controls - takes 1 column */}
          <div className="space-y-6">
            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span className="flex-1">{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismissError}
                    className="h-6 w-6 p-0 ml-2 hover:bg-destructive/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <PaddingControls
              padding={padding}
              onPaddingChange={setPadding}
              min={0}
              max={10}
              step={0.5}
            />

            {/* Confirmation Button */}
            <Button
              onClick={handleConfirm}
              size="lg"
              className="w-full"
            >
              <Check className="w-5 h-5 mr-2" />
              Looks Good
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Apply padding to SVG by expanding the viewBox and paths
 * This is a simplified implementation - a real implementation would
 * need more sophisticated SVG path manipulation
 */
function applyPaddingToSvg(
  svgContent: string,
  paddingMm: number,
  pixelsPerMm: number
): string {
  try {
    const paddingPx = paddingMm * pixelsPerMm

    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, "image/svg+xml")

    // Check for parsing errors
    const parserError = doc.querySelector("parsererror")
    if (parserError) {
      throw new Error("Invalid SVG content")
    }

    const svgEl = doc.querySelector("svg")

    if (!svgEl) {
      throw new Error("No SVG element found")
    }

    // Get current viewBox
    const viewBox = svgEl.getAttribute("viewBox")
    if (viewBox) {
      const parts = viewBox.split(" ").map(Number)

      // Validate viewBox values
      if (parts.length !== 4 || parts.some(isNaN)) {
        throw new Error("Invalid viewBox format")
      }

      const [x, y, width, height] = parts

      // Expand viewBox by padding
      const newViewBox = [
        x - paddingPx,
        y - paddingPx,
        width + paddingPx * 2,
        height + paddingPx * 2,
      ].join(" ")

      svgEl.setAttribute("viewBox", newViewBox)
    }

    // For a real implementation, you would also need to:
    // 1. Offset all paths by the padding amount
    // 2. Or apply a transform to the group containing all paths
    // For now, we'll add a transform to shift content
    const g = doc.createElementNS("http://www.w3.org/2000/svg", "g")
    g.setAttribute("transform", `translate(${paddingPx}, ${paddingPx})`)

    // Move all existing children into the group
    while (svgEl.firstChild) {
      g.appendChild(svgEl.firstChild)
    }

    svgEl.appendChild(g)

    // Serialize back to string
    const serializer = new XMLSerializer()
    const result = serializer.serializeToString(svgEl)

    if (!result || result.trim().length === 0) {
      throw new Error("Failed to serialize SVG")
    }

    return result
  } catch (error) {
    console.error("Error applying padding to SVG:", error)
    // Return original content if padding fails
    return svgContent
  }
}
