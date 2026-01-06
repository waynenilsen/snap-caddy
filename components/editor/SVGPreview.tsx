"use client"

import * as React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface SVGPreviewProps {
  svgContent: string
  pixelsPerMm: number
  zoom?: number
  onZoomChange?: (zoom: number) => void
  showGrid?: boolean
  gridSize?: number // mm
}

export function SVGPreview({
  svgContent,
  pixelsPerMm,
  zoom: controlledZoom,
  onZoomChange,
  showGrid = true,
  gridSize = 10, // mm
}: SVGPreviewProps) {
  const [internalZoom, setInternalZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<HTMLDivElement>(null)

  // Use controlled zoom if provided, otherwise use internal state
  const zoom = controlledZoom ?? internalZoom
  const setZoom = (value: number) => {
    if (onZoomChange) {
      onZoomChange(value)
    } else {
      setInternalZoom(value)
    }
  }

  // Parse SVG to get dimensions
  useEffect(() => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, "image/svg+xml")
    const svgEl = doc.querySelector("svg")

    if (svgEl) {
      const viewBox = svgEl.getAttribute("viewBox")
      if (viewBox) {
        const [, , width, height] = viewBox.split(" ").map(Number)
        // Convert pixels to mm
        setDimensions({
          width: width / pixelsPerMm,
          height: height / pixelsPerMm,
        })
      } else {
        const width = parseFloat(svgEl.getAttribute("width") || "0")
        const height = parseFloat(svgEl.getAttribute("height") || "0")
        setDimensions({
          width: width / pixelsPerMm,
          height: height / pixelsPerMm,
        })
      }
    }
  }, [svgContent, pixelsPerMm])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    setIsPanning(true)
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    })
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }, [isPanning, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(Math.min(Math.max(zoom + delta, 0.5), 3))
  }, [zoom, setZoom])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>SVG Preview</CardTitle>
            <CardDescription>
              {dimensions.width > 0 && dimensions.height > 0 ? (
                <>
                  {dimensions.width.toFixed(1)}mm × {dimensions.height.toFixed(1)}mm
                </>
              ) : (
                "Loading dimensions..."
              )}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="zoom" className="text-sm">
              Zoom
            </Label>
            <Slider
              id="zoom"
              min={0.5}
              max={3}
              step={0.1}
              value={[zoom]}
              onValueChange={([v]) => setZoom(v)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground w-12">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div
          ref={containerRef}
          className={cn(
            "relative border rounded-lg overflow-hidden",
            "bg-muted/30",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ minHeight: "400px" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Grid background */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${gridSize * pixelsPerMm * zoom}px ${gridSize * pixelsPerMm * zoom}px`,
              }}
            />
          )}

          {/* SVG Content */}
          <div
            ref={svgRef}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: svgContent }}
              className="select-none [&_svg]:max-w-full [&_svg]:h-auto"
            />
          </div>
        </div>

        {showGrid && (
          <div className="mt-4 text-xs text-muted-foreground text-center">
            Grid: {gridSize}mm ({(gridSize * pixelsPerMm).toFixed(1)}px)
          </div>
        )}

        <div className="mt-2 text-xs text-muted-foreground text-center">
          Drag to pan • Scroll to zoom
        </div>
      </CardContent>
    </Card>
  )
}
