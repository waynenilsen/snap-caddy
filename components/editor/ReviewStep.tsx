"use client"

import * as React from "react"
import { useState } from "react"
import { SVGPreview } from "./SVGPreview"
import { PaddingControls } from "./PaddingControls"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

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

  const handleConfirm = () => {
    // Apply padding to SVG
    const paddedSvg = applyPaddingToSvg(svgContent, padding, pixelsPerMm)
    onConfirm(paddedSvg, padding)
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
  const paddingPx = paddingMm * pixelsPerMm

  const parser = new DOMParser()
  const doc = parser.parseFromString(svgContent, "image/svg+xml")
  const svgEl = doc.querySelector("svg")

  if (!svgEl) return svgContent

  // Get current viewBox
  const viewBox = svgEl.getAttribute("viewBox")
  if (viewBox) {
    const [x, y, width, height] = viewBox.split(" ").map(Number)

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
  return serializer.serializeToString(svgEl)
}
