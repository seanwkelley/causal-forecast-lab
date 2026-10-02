// Layered (Sugiyama-style) layout for an elicited causal network.
// Causes flow into the outcome: left to right by default, top to bottom
// when the network is too deep for the available width. Cycles are broken
// for layout purposes (those links are drawn as dashed return arcs), and
// factors with no path to the outcome sit in a separate band.

export interface LayoutInputNode {
  id: string;
  label: string;
  isOutcome: boolean;
}

export interface LayoutInputEdge {
  source: string;
  target: string;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  column: number;
  connected: boolean;
  isOutcome: boolean;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  path: string;
  /** Link that closes a cycle; drawn as a return arc */
  feedback: boolean;
  midX: number;
  midY: number;
}

export type Direction = "LR" | "TB";

export interface Layout {
  width: number;
  height: number;
  direction: Direction;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  hasCycle: boolean;
  /** Factor ids with no directed path to the outcome */
  unlinked: string[];
  /** Where the band of unlinked factors starts (y for LR, x for TB) */
  band: { direction: Direction; pos: number } | null;
}

export interface LayoutOptions {
  /** Width available; the layout grows beyond it (scrolls) if it must */
  availableWidth: number;
  direction?: Direction;
  nodeWidth?: number;
  minColGap?: number;
  maxColGap?: number;
  rowGap?: number;
  padX?: number;
  padY?: number;
  charsPerLine?: number;
  maxLines?: number;
  lineHeight?: number;
  /** Extra vertical space inside each box (e.g. for a value line) */
  extraHeight?: number;
  /** Extra vertical space inside the outcome box (eyebrow) */
  outcomeExtra?: number;
}

export function wrapLabel(text: string, charsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let word of words) {
    while (word.length > charsPerLine) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(word.slice(0, charsPerLine - 1) + "-");
      word = word.slice(charsPerLine - 1);
    }
    if (!current) current = word;
    else if ((current + " " + word).length <= charsPerLine) current += " " + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] =
      (last.length >= charsPerLine ? last.slice(0, charsPerLine - 1) : last).replace(/-$/, "") + "…";
    return kept;
  }
  return lines;
}

export function layoutCausalGraph(
  inputNodes: LayoutInputNode[],
  inputEdges: LayoutInputEdge[],
  opts: LayoutOptions
): Layout {
  const nodeWidth = opts.nodeWidth ?? 148;
  const minColGap = opts.minColGap ?? 48;
  const maxColGap = opts.maxColGap ?? 140;
  const rowGap = opts.rowGap ?? 16;
  const padX = opts.padX ?? 12;
  const padY = opts.padY ?? 16;
  const charsPerLine = opts.charsPerLine ?? 20;
  const maxLines = opts.maxLines ?? 3;
  const lineHeight = opts.lineHeight ?? 14;
  const extraHeight = opts.extraHeight ?? 0;
  const outcomeExtra = opts.outcomeExtra ?? 0;
  const direction = opts.direction ?? "LR";

  const ids = inputNodes.map((n) => n.id);
  const idSet = new Set(ids);
  const edges = inputEdges.filter(
    (e) => idSet.has(e.source) && idSet.has(e.target) && e.source !== e.target
  );

  const outAdj = new Map<string, string[]>(ids.map((id) => [id, []]));
  const inAdj = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) {
    outAdj.get(e.source)!.push(e.target);
    inAdj.get(e.target)!.push(e.source);
  }

  let outcomeId = inputNodes.find((n) => n.isOutcome)?.id;
  if (!outcomeId) {
    const sinks = ids.filter((id) => outAdj.get(id)!.length === 0);
    outcomeId = sinks.sort((a, b) => inAdj.get(b)!.length - inAdj.get(a)!.length)[0] ?? ids[0];
  }

  // --- 1. Break cycles with a DFS; back edges become feedback links -------
  const feedback = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>(); // 0 new, 1 on stack, 2 done
  const startOrder = [
    ...ids.filter((id) => inAdj.get(id)!.length === 0),
    ...ids.filter((id) => inAdj.get(id)!.length > 0),
  ];
  for (const start of startOrder) {
    if (state.get(start)) continue;
    const stack: Array<{ id: string; i: number }> = [{ id: start, i: 0 }];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const succ = outAdj.get(top.id)!;
      if (top.i < succ.length) {
        const next = succ[top.i++];
        const s = state.get(next) ?? 0;
        if (s === 1) feedback.add(`${top.id}->${next}`);
        else if (s === 0) {
          state.set(next, 1);
          stack.push({ id: next, i: 0 });
        }
      } else {
        state.set(top.id, 2);
        stack.pop();
      }
    }
  }
  const dagOut = new Map<string, string[]>(
    ids.map((id) => [id, outAdj.get(id)!.filter((t) => !feedback.has(`${id}->${t}`))])
  );
  const dagIn = new Map<string, string[]>(
    ids.map((id) => [id, inAdj.get(id)!.filter((s) => !feedback.has(`${s}->${id}`))])
  );

  // --- 2. Which factors can reach the outcome? ---------------------------
  const connected = new Set<string>([outcomeId]);
  const queue = [outcomeId];
  while (queue.length) {
    const v = queue.shift()!;
    for (const u of inAdj.get(v)!) {
      if (!connected.has(u)) {
        connected.add(u);
        queue.push(u);
      }
    }
  }

  // --- 3. Longest-path distance to the outcome (or to a local sink) ------
  const dist = new Map<string, number>();
  const distOf = (v: string, visiting = new Set<string>()): number => {
    if (dist.has(v)) return dist.get(v)!;
    if (visiting.has(v)) return 0;
    visiting.add(v);
    let d: number;
    if (v === outcomeId) d = 0;
    else {
      const isConn = connected.has(v);
      const succ = dagOut.get(v)!.filter((t) => connected.has(t) === isConn);
      // Unlinked sinks sit one column left of the outcome
      if (succ.length === 0) d = 1;
      else d = 1 + Math.max(...succ.map((t) => distOf(t, visiting)));
    }
    visiting.delete(v);
    dist.set(v, d);
    return d;
  };
  ids.forEach((id) => distOf(id));
  const maxDist = Math.max(0, ...dist.values());
  const columnOf = (id: string) => maxDist - dist.get(id)!;
  const nCols = maxDist + 1;

  // --- 4. Order nodes within each column (barycentre sweeps) -------------
  const bands: Array<string[][]> = [0, 1].map(() =>
    Array.from({ length: nCols }, () => [] as string[])
  );
  for (const id of ids) bands[connected.has(id) ? 0 : 1][columnOf(id)].push(id);

  const position = new Map<string, number>();
  const setPositions = (col: string[]) =>
    col.forEach((id, i) => position.set(id, col.length > 1 ? i / (col.length - 1) : 0.5));
  for (const band of bands) band.forEach(setPositions);
  const bary = (id: string, neigh: string[]) => {
    const ps = neigh.map((n) => position.get(n)!).filter((p) => p !== undefined);
    return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : position.get(id)!;
  };
  for (let iter = 0; iter < 6; iter++) {
    const leftToRight = iter % 2 === 0;
    for (const band of bands) {
      const order = leftToRight ? band.map((_, i) => i) : band.map((_, i) => band.length - 1 - i);
      for (const c of order) {
        const col = band[c];
        const keyed = col.map((id) => ({
          id,
          k: bary(id, leftToRight ? dagIn.get(id)! : dagOut.get(id)!),
        }));
        keyed.sort((a, b) => a.k - b.k);
        band[c] = keyed.map((x) => x.id);
        setPositions(band[c]);
      }
    }
  }

  // --- 5. Box sizes and coordinates --------------------------------------
  const labelOf = new Map(inputNodes.map((n) => [n.id, n.label]));
  const sizes = new Map<string, { lines: string[]; h: number }>();
  for (const id of ids) {
    const lines = wrapLabel(labelOf.get(id) ?? id, charsPerLine, maxLines);
    const h = 14 + lines.length * lineHeight + extraHeight + (id === outcomeId ? outcomeExtra : 0);
    sizes.set(id, { lines, h });
  }
  const placed = new Map<string, LayoutNode>();
  const put = (id: string, x: number, y: number, c: number) => {
    const { lines, h } = sizes.get(id)!;
    placed.set(id, {
      id,
      x,
      y,
      w: nodeWidth,
      h,
      lines,
      column: c,
      connected: connected.has(id),
      isOutcome: id === outcomeId,
    });
  };

  let width: number;
  let height: number;
  let band: Layout["band"] = null;
  const hasLower = bands[1].some((col) => col.length > 0);

  if (direction === "LR") {
    const needed = padX * 2 + nCols * nodeWidth + Math.max(0, nCols - 1) * minColGap;
    width = Math.max(opts.availableWidth, needed);
    const colGap =
      nCols > 1 ? Math.min(maxColGap, (width - padX * 2 - nCols * nodeWidth) / (nCols - 1)) : 0;
    const contentWidth = nCols * nodeWidth + Math.max(0, nCols - 1) * colGap;
    const offsetX = (width - contentWidth) / 2;
    const colX = (c: number) => offsetX + c * (nodeWidth + colGap);
    const stackHeight = (col: string[]) =>
      col.reduce((sum, id) => sum + sizes.get(id)!.h, 0) + Math.max(0, col.length - 1) * rowGap;
    const mainHeight = Math.max(...bands[0].map(stackHeight), 0);
    const lowerHeight = hasLower ? Math.max(...bands[1].map(stackHeight)) : 0;
    const bandGap = hasLower ? 56 : 0;
    const placeBand = (cols: string[][], top: number, bandHeight: number) =>
      cols.forEach((col, c) => {
        let y = top + (bandHeight - stackHeight(col)) / 2;
        for (const id of col) {
          put(id, colX(c), y, c);
          y += sizes.get(id)!.h + rowGap;
        }
      });
    placeBand(bands[0], padY, mainHeight);
    if (hasLower) {
      const bandTop = padY + mainHeight + bandGap;
      placeBand(bands[1], bandTop, lowerHeight);
      band = { direction, pos: bandTop };
    }
    height = padY * 2 + mainHeight + bandGap + lowerHeight;
  } else {
    // Top to bottom: layers become rows; the unlinked band sits to the right
    const gapX = 14;
    const layerGap = 40;
    const rowWidth = (col: string[]) => col.length * nodeWidth + Math.max(0, col.length - 1) * gapX;
    const mainWidth = Math.max(...bands[0].map(rowWidth), nodeWidth);
    const lowerWidth = hasLower ? Math.max(...bands[1].map(rowWidth)) : 0;
    const bandGap = hasLower ? 48 : 0;
    const contentWidth = mainWidth + bandGap + lowerWidth;
    width = Math.max(opts.availableWidth, padX * 2 + contentWidth);
    const left = (width - contentWidth) / 2;
    const top = padY + (hasLower ? 18 : 0);
    const rowHeights = Array.from({ length: nCols }, (_, c) =>
      Math.max(0, ...[...bands[0][c], ...bands[1][c]].map((id) => sizes.get(id)!.h))
    );
    const rowTop: number[] = [];
    let y = top;
    for (let c = 0; c < nCols; c++) {
      rowTop.push(y);
      y += rowHeights[c] + (c < nCols - 1 ? layerGap : 0);
    }
    const placeBand = (cols: string[][], x0: number, bandWidth: number) =>
      cols.forEach((col, c) => {
        let x = x0 + (bandWidth - rowWidth(col)) / 2;
        for (const id of col) {
          put(id, x, rowTop[c] + (rowHeights[c] - sizes.get(id)!.h) / 2, c);
          x += nodeWidth + gapX;
        }
      });
    placeBand(bands[0], left, mainWidth);
    if (hasLower) {
      const bandLeft = left + mainWidth + bandGap;
      placeBand(bands[1], bandLeft, lowerWidth);
      band = { direction, pos: bandLeft };
    }
    height = y + padY;
  }

  // --- 6. Edge routes with spread ports ----------------------------------
  const lr = direction === "LR";
  const forward = edges.filter((e) => {
    const s = placed.get(e.source)!;
    const t = placed.get(e.target)!;
    return !feedback.has(`${e.source}->${e.target}`) && t.column > s.column;
  });
  const outPorts = new Map<string, number>();
  const inPorts = new Map<string, number>();
  const centre = (n: LayoutNode) => (lr ? n.y + n.h / 2 : n.x + n.w / 2);
  const spread = (
    nodeId: string,
    list: LayoutInputEdge[],
    other: "source" | "target",
    into: Map<string, number>
  ) => {
    const node = placed.get(nodeId)!;
    const sorted = [...list].sort((a, b) => centre(placed.get(a[other])!) - centre(placed.get(b[other])!));
    const n = sorted.length;
    const span = lr ? Math.min(node.h - 14, (n - 1) * 9) : Math.min(node.w - 24, (n - 1) * 14);
    sorted.forEach((e, i) => {
      const offset = n > 1 ? -span / 2 + (span * i) / (n - 1) : 0;
      into.set(`${e.source}->${e.target}`, centre(node) + offset);
    });
  };
  for (const id of ids) {
    spread(id, forward.filter((e) => e.source === id), "target", outPorts);
    spread(id, forward.filter((e) => e.target === id), "source", inPorts);
  }

  let returnArcs = 0;
  const routed: LayoutEdge[] = edges.map((e) => {
    const key = `${e.source}->${e.target}`;
    const s = placed.get(e.source)!;
    const t = placed.get(e.target)!;
    const isFeedback = feedback.has(key);
    const base = { id: key, source: e.source, target: e.target };
    if (!isFeedback && t.column > s.column) {
      if (lr) {
        const x1 = s.x + s.w;
        const y1 = outPorts.get(key) ?? s.y + s.h / 2;
        const x2 = t.x - 2;
        const y2 = inPorts.get(key) ?? t.y + t.h / 2;
        const dx = Math.max(24, (x2 - x1) * 0.5);
        return {
          ...base,
          feedback: false,
          path: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`,
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2,
        };
      }
      const x1 = outPorts.get(key) ?? s.x + s.w / 2;
      const y1 = s.y + s.h;
      const x2 = inPorts.get(key) ?? t.x + t.w / 2;
      const y2 = t.y - 2;
      const dy = Math.max(16, (y2 - y1) * 0.5);
      return {
        ...base,
        feedback: false,
        path: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`,
        midX: (x1 + x2) / 2,
        midY: (y1 + y2) / 2,
      };
    }
    // Return arc for links that close a cycle or run against the layering
    returnArcs++;
    if (lr) {
      const x1 = s.x + s.w * 0.6;
      const y1 = s.y + s.h;
      const x2 = t.x + t.w * 0.4;
      const y2 = t.y + t.h + 2;
      const drop = 26 + Math.abs(x2 - x1) * 0.12;
      const low = Math.max(y1, y2) + drop;
      return {
        ...base,
        feedback: isFeedback,
        path: `M${x1},${y1} C${x1},${low} ${x2},${low} ${x2},${y2}`,
        midX: (x1 + x2) / 2,
        midY: low - drop * 0.25,
      };
    }
    const x1 = s.x + s.w;
    const y1 = s.y + s.h * 0.6;
    const x2 = t.x + t.w + 2;
    const y2 = t.y + t.h * 0.4;
    const bulge = 26 + Math.abs(y2 - y1) * 0.12;
    const right = Math.max(x1, x2) + bulge;
    return {
      ...base,
      feedback: isFeedback,
      path: `M${x1},${y1} C${right},${y1} ${right},${y2} ${x2},${y2}`,
      midX: right - bulge * 0.25,
      midY: (y1 + y2) / 2,
    };
  });

  if (returnArcs > 0) {
    if (lr) height += 36;
    else width = Math.max(width, Math.max(...[...placed.values()].map((n) => n.x + n.w)) + 48);
  }

  return {
    width,
    height,
    direction,
    nodes: ids.map((id) => placed.get(id)!),
    edges: routed,
    hasCycle: feedback.size > 0,
    unlinked: ids.filter((id) => !connected.has(id)),
    band,
  };
}

/**
 * Lay out left to right when that fits the available width; otherwise top to
 * bottom. If neither fits, use whichever needs less horizontal scrolling.
 */
export function layoutBestFit(
  inputNodes: LayoutInputNode[],
  inputEdges: LayoutInputEdge[],
  opts: LayoutOptions
): Layout {
  const lr = layoutCausalGraph(inputNodes, inputEdges, { ...opts, direction: "LR" });
  if (lr.width <= opts.availableWidth + 1) return lr;
  const tb = layoutCausalGraph(inputNodes, inputEdges, { ...opts, direction: "TB" });
  return tb.width <= lr.width ? tb : lr;
}
