"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";
import type { NodeMetrics, EdgeMetrics, ProbeResult } from "@/lib/types";
import { importanceToColor } from "@/lib/utils";

interface CausalNetworkProps {
  nodes: NodeMetrics[];
  edges: EdgeMetrics[];
  probeResults?: ProbeResult[];
  onNodeClick?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  width?: number;
  height?: number;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  description: string;
  role: string;
  betweenness: number;
  pagerank: number;
  sensitivity: number;
  in_degree: number;
  out_degree: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  mechanism: string;
  edge_betweenness: number;
  on_critical_path: boolean;
}

export function CausalNetwork({
  nodes,
  edges,
  probeResults = [],
  onNodeClick,
  selectedNodeId,
  width: propWidth,
  height: propHeight,
}: CausalNetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeSelRef = useRef<d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown> | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const [dimensions, setDimensions] = useState({ width: propWidth || 700, height: propHeight || 650 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: SimNode;
  } | null>(null);

  // Compute per-node sensitivity from probe results
  const nodeSensitivity = useCallback(() => {
    const map: Record<string, number[]> = {};
    for (const r of probeResults) {
      if (r.target_type === "node" && r.absolute_shift != null) {
        if (!map[r.target_id]) map[r.target_id] = [];
        map[r.target_id].push(r.absolute_shift);
      }
    }
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
      result[k] = v.reduce((a, b) => a + b, 0) / v.length;
    }
    return result;
  }, [probeResults]);

  // Resize observer
  useEffect(() => {
    if (propWidth && propHeight) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: width || 700, height: height || 650 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [propWidth, propHeight]);

  // Keep callback ref current without triggering simulation rebuild
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  // Update selection highlight without rebuilding simulation
  useEffect(() => {
    if (!nodeSelRef.current) return;
    nodeSelRef.current.attr("stroke", (d) =>
      selectedNodeId === d.id ? "#fafafa" : "transparent"
    );
  }, [selectedNodeId]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const { width, height } = dimensions;
    const sens = nodeSensitivity();

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Arrow marker
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#52525b");

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead-critical")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#3b82f6");

    // Build simulation data
    const simNodes: SimNode[] = nodes.map((n) => ({
      id: n.node_id,
      description: n.description,
      role: n.role,
      betweenness: n.betweenness,
      pagerank: n.pagerank,
      sensitivity: sens[n.node_id] ?? 0,
      in_degree: n.in_degree,
      out_degree: n.out_degree,
    }));

    const simLinks: SimLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      mechanism: e.mechanism,
      edge_betweenness: e.edge_betweenness,
      on_critical_path: e.on_critical_path,
    }));

    // Container for zoom
    const g = svg.append("g");

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Links
    const link = g
      .append("g")
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", (d) => (d.on_critical_path ? "#3b82f6" : "#52525b"))
      .attr("stroke-width", (d) =>
        Math.max(1, d.edge_betweenness * 8)
      )
      .attr("stroke-opacity", (d) => (d.on_critical_path ? 0.8 : 0.4))
      .attr("marker-end", (d) =>
        d.on_critical_path
          ? "url(#arrowhead-critical)"
          : "url(#arrowhead)"
      );

    // Nodes
    const nodeRadius = (d: SimNode) =>
      Math.max(8, d.betweenness * 30 + 8);

    const node = g
      .append("g")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(simNodes)
      .join("circle")
      .attr("r", nodeRadius)
      .attr("fill", (d) => {
        if (d.role === "outcome") return "#f59e0b";
        if (d.sensitivity > 0) {
          // Blend between importance color and red based on sensitivity
          const t = Math.min(d.sensitivity * 5, 1);
          return d3.interpolateRgb(
            importanceToColor(d.betweenness),
            "#ef4444"
          )(t);
        }
        return importanceToColor(d.betweenness);
      })
      .attr("stroke", "transparent")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        onNodeClickRef.current?.(d.id);
      })
      .on("mouseover", (event, d) => {
        const [x, y] = d3.pointer(event, containerRef.current);
        setTooltip({ x, y: y - 10, node: d });
      })
      .on("mouseout", () => setTooltip(null));

    // Labels
    const label = g
      .append("g")
      .selectAll<SVGTextElement, SimNode>("text")
      .data(simNodes)
      .join("text")
      .text((d) =>
        d.id.length > 18 ? d.id.slice(0, 17) + "…" : d.id
      )
      .attr("font-size", 9)
      .attr("fill", "#a1a1aa")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d) + 12)
      .attr("pointer-events", "none");

    // Drag
    const drag = d3
      .drag<SVGCircleElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = d.x;
        d.fy = d.y;
      });

    node.call(drag);
    nodeSelRef.current = node;

    // Simulation
    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((d) => nodeRadius(d) + 25))
      .alphaDecay(0.05)
      .on("tick", () => {
        link
          .attr("x1", (d) => (d.source as SimNode).x!)
          .attr("y1", (d) => (d.source as SimNode).y!)
          .attr("x2", (d) => (d.target as SimNode).x!)
          .attr("y2", (d) => (d.target as SimNode).y!);

        node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);

        label.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
      })
      .on("end", () => {
        // Pin all nodes in place after layout converges
        simNodes.forEach((d) => {
          d.fx = d.x;
          d.fy = d.y;
        });
      });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, dimensions, nodeSensitivity]);

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: propHeight || 650 }}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
      {/* Legend */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 text-[10px] text-[var(--color-muted-foreground)] bg-[var(--color-background)]/80 backdrop-blur-sm rounded-md p-2 border border-[var(--color-border)]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
          Outcome
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
          High importance
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
          Medium importance
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#6b7280]" />
          Low importance
        </div>
        <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-[var(--color-border)]">
          <span className="h-0.5 w-4 bg-[#3b82f6]" />
          Critical path
        </div>
      </div>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-lg max-w-[250px]"
          style={{ left: tooltip.x + 10, top: tooltip.y }}
        >
          <p className="font-mono text-xs text-[var(--color-primary)] font-medium">
            {tooltip.node.id}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
            {tooltip.node.description}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-[var(--color-muted-foreground)]">
              Betweenness:
            </span>
            <span className="font-mono">
              {tooltip.node.betweenness.toFixed(3)}
            </span>
            {tooltip.node.sensitivity > 0 && (
              <>
                <span className="text-[var(--color-muted-foreground)]">
                  Avg |Δ|:
                </span>
                <span className="font-mono text-[var(--color-negative)]">
                  {(tooltip.node.sensitivity * 100).toFixed(1)}pp
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
