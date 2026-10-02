"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play, RotateCcw } from "lucide-react";
import { layoutCausalGraph } from "@/lib/graph-layout";
import { humanize } from "@/lib/probes";
import { cn, formatDelta, formatProbability } from "@/lib/utils";
import type { DemoData } from "./probe-demo";

// A ~40-second animated walkthrough of one run, drawn from real data.
// Every frame is a pure function of the playhead, so scrubbing just works.

const DURATION = 40;

interface Chapter {
  title: string;
  start: number;
  end: number;
  caption: (d: VideoData) => string;
}

export interface VideoData extends DemoData {
  ssr: number | null;
}

const CHAPTERS: Chapter[] = [
  {
    title: "Ask",
    start: 0,
    end: 4.5,
    caption: () => "We ask a language model a yes/no forecasting question.",
  },
  {
    title: "Forecast and network",
    start: 4.5,
    end: 11,
    caption: () =>
      "It gives a probability, plus the causal network behind it: factors, the links between them, and the outcome.",
  },
  {
    title: "Measure structure",
    start: 11,
    end: 17,
    caption: () =>
      "We measure how central each factor is in that network. This step is pure computation; no model is involved.",
  },
  {
    title: "Probe and re-forecast",
    start: 17,
    end: 25,
    caption: (d) =>
      `The model writes a probe aimed at one factor, then answers again in a fresh conversation. This one moved the forecast from ${formatProbability(d.p0)} to ${formatProbability(d.probes[0].p1)}.`,
  },
  {
    title: "Compare targets",
    start: 25,
    end: 33,
    caption: (d) =>
      `Each run has about 21 probes (${d.totalProbes} here), aimed at central and peripheral targets, plus irrelevant controls that should change nothing.`,
  },
  {
    title: "Summarize",
    start: 33,
    end: DURATION,
    caption: () =>
      "If the forecast follows the model’s own network, central targets should move it most. The structural sensitivity ratio compares the two.",
  },
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
/** 0 → 1 between start and start + dur */
const tw = (t: number, start: number, dur = 0.45) => ease((t - start) / dur);
/** Fade in at `a`, fade out at `b` */
const span = (t: number, a: number, b: number, d = 0.4) => Math.min(tw(t, a, d), 1 - tw(t, b - d, d));

const fmtTime = (s: number) => `0:${String(Math.floor(s)).padStart(2, "0")}`;

export function MethodVideo({ data }: { data: VideoData }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [reduced, setReduced] = useState(false);
  const autoplayed = useRef(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setPortrait(el.clientWidth < 640);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
  }, []);

  // Autoplay once when the player is mostly in view; pause when it leaves.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (!autoplayed.current && !reduced) {
            autoplayed.current = true;
            setPlaying(true);
          }
        } else if (!entry.isIntersecting) {
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // Playback clock
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((prev) => {
        const next = prev + dt;
        if (next >= DURATION) {
          setPlaying(false);
          return DURATION;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const chapterIndex = Math.max(0, CHAPTERS.findIndex((c) => t >= c.start && t < c.end));
  const chapter = t >= DURATION ? CHAPTERS[CHAPTERS.length - 1] : CHAPTERS[chapterIndex];
  const activeIndex = CHAPTERS.indexOf(chapter);
  // With reduced motion, show each chapter's finished state instead of tweening
  const ft = reduced ? chapter.end - 0.5 : t;
  const ended = t >= DURATION;

  const togglePlay = () => {
    if (ended) {
      setT(0);
      setPlaying(true);
    } else setPlaying((p) => !p);
  };

  const seek = (time: number) => setT(Math.min(DURATION, Math.max(0, time)));

  return (
    <div ref={wrapRef} className="w-full">
      <div
        className="overflow-hidden rounded-2xl border border-rule bg-surface shadow-[0_1px_0_var(--rule),0_24px_60px_-36px_rgba(20,22,27,0.45)]"
        onClick={togglePlay}
        role="presentation"
      >
        <Stage data={data} t={ft} portrait={portrait} chapterIndex={activeIndex} />
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={ended ? "Replay" : playing ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-opacity hover:opacity-90"
        >
          {ended ? <RotateCcw size={15} /> : playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
        </button>
        <span className="num shrink-0 whitespace-nowrap text-xs text-ink-3">
          {fmtTime(t)} / {fmtTime(DURATION)}
        </span>
        <div
          className="relative h-6 flex-1 cursor-pointer"
          role="slider"
          tabIndex={0}
          aria-label="Playback position"
          aria-valuemin={0}
          aria-valuemax={DURATION}
          aria-valuenow={Math.round(t)}
          aria-valuetext={`${fmtTime(t)}, ${chapter.title}`}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * DURATION);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seek(t + 2);
            if (e.key === "ArrowLeft") seek(t - 2);
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              togglePlay();
            }
          }}
        >
          <div className="absolute inset-x-0 top-1/2 flex h-1.5 -translate-y-1/2 gap-0.5">
            {CHAPTERS.map((c, i) => (
              <div
                key={c.title}
                className="relative h-full overflow-hidden rounded-full bg-surface-2"
                style={{ flex: c.end - c.start }}
              >
                <div
                  className={cn("absolute inset-y-0 left-0", i === activeIndex ? "bg-accent" : "bg-ink-3")}
                  style={{ width: `${clamp01((t - c.start) / (c.end - c.start)) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <ol className="mt-3 flex flex-wrap gap-1.5">
        {CHAPTERS.map((c, i) => (
          <li key={c.title}>
            <button
              type="button"
              onClick={() => {
                seek(c.start + 0.01);
                if (!playing) setPlaying(true);
              }}
              aria-current={i === activeIndex ? "step" : undefined}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                i === activeIndex
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-rule text-ink-2 hover:border-rule-strong hover:text-ink"
              )}
            >
              <span className="num mr-1.5 opacity-60">{i + 1}</span>
              {c.title}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <details className="text-xs text-ink-2">
          <summary className="cursor-pointer text-ink-3 hover:text-ink">Read the transcript</summary>
          <ol className="mt-2 max-w-2xl list-decimal space-y-1 pl-5 leading-relaxed">
            {CHAPTERS.map((c) => (
              <li key={c.title}>
                <span className="font-medium text-ink">{c.title}.</span> {c.caption(data)}
              </li>
            ))}
          </ol>
        </details>
        {ended && (
          <Link
            href={`/explore/${encodeURIComponent(data.questionId)}?model=${data.modelKey}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Open this question in the explorer <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stage({
  data,
  t,
  portrait,
  chapterIndex,
}: {
  data: VideoData;
  t: number;
  portrait: boolean;
  chapterIndex: number;
}) {
  const W = portrait ? 600 : 960;
  const H = portrait ? 880 : 566;
  const region = portrait ? { x: 20, y: 112, w: 560, h: 410 } : { x: 28, y: 76, w: 540, h: 392 };
  const panel = portrait ? { x: 28, y: 536, w: 544, h: 236 } : { x: 600, y: 76, w: 332, h: 392 };
  const caption = portrait ? { x: 28, y: 784, w: 544, h: 90 } : { x: 28, y: 482, w: 904, h: 78 };

  const [central, peripheral, control] = data.probes;

  const layout = useMemo(
    () =>
      layoutCausalGraph(
        data.nodes.map((n) => ({
          id: n.node_id,
          label:
            n.role === "outcome" && /^(outcome|target|result|event|yes)$/i.test(n.node_id)
              ? n.description
              : humanize(n.node_id),
          isOutcome: n.role === "outcome",
        })),
        data.edges.map((e) => ({ source: e.source, target: e.target })),
        {
          availableWidth: 0,
          direction: "TB",
          nodeWidth: 150,
          charsPerLine: 18,
          maxLines: 3,
          lineHeight: 15,
          outcomeExtra: 12,
          padX: 4,
          padY: 6,
        }
      ),
    [data]
  );
  const scale = Math.min(region.w / layout.width, region.h / layout.height, 1.35);
  const gx = region.x + (region.w - layout.width * scale) / 2;
  const gy = region.y + (region.h - layout.height * scale) / 2;

  const factors = data.nodes.filter((n) => n.role !== "outcome");
  const maxB = Math.max(0.0001, ...factors.map((n) => n.betweenness));
  const nodeById = new Map(data.nodes.map((n) => [n.node_id, n]));
  const edgeById = new Map(data.edges.map((e) => [`${e.source}->${e.target}`, e]));
  const colOf = new Map(layout.nodes.map((n) => [n.id, n.column]));

  // Timeline values
  const shade = tw(t, 11.6, 1.6);
  // Which factor carries the highlight ring, and how strongly
  const [ringTarget, ringOpacity]: [string | null, number] =
    t >= 17.4 && t < 25.3
      ? [central.targetId, span(t, 17.4, 25.3)]
      : t >= 25.4 && t < 27
        ? [central.targetId, span(t, 25.4, 27)]
        : t >= 27 && t < 28.6
          ? [peripheral.targetId, span(t, 27, 28.6)]
          : [null, 0];
  const focusDim = t >= 17.4 && t < 25 ? span(t, 17.4, 25) : 0;
  const reveal = (col: number) => tw(t, 5.3 + col * 0.55, 0.45);

  const topFactors = [...factors].sort((a, b) => b.betweenness - a.betweenness).slice(0, 4);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full select-none"
      role="img"
      aria-label={`Animated walkthrough, chapter ${chapterIndex + 1} of ${CHAPTERS.length}: ${CHAPTERS[chapterIndex].title}. ${CHAPTERS[chapterIndex].caption(data)}`}
    >
      <defs>
        <marker id="mv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--ink-2)" }} />
        </marker>
      </defs>
      <rect width={W} height={H} style={{ fill: "var(--surface)" }} />

      {/* Header: question + chapter */}
      <foreignObject x={28} y={portrait ? 22 : 20} width={portrait ? W - 56 : 620} height={portrait ? 80 : 50} opacity={tw(t, 4.2, 0.5)}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: portrait ? 23 : 21, lineHeight: 1.2, color: "var(--ink)" }}>
          {data.question}
        </div>
      </foreignObject>
      {!portrait && (
        <text x={W - 28} y={38} textAnchor="end" style={{ fill: "var(--ink-3)", fontFamily: "var(--font-sans)", fontSize: 11, letterSpacing: "0.08em", fontWeight: 600 }}>
          {`${chapterIndex + 1} / ${CHAPTERS.length}  ·  ${CHAPTERS[chapterIndex].title.toUpperCase()}`}
        </text>
      )}

      {/* Chapter 1: the question, large */}
      <foreignObject x={portrait ? 40 : 120} y={portrait ? 260 : 150} width={portrait ? W - 80 : W - 240} height={portrait ? 320 : 240} opacity={span(t, 0.3, 4.4, 0.6)}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: "0.1em", fontWeight: 600, color: "var(--ink-3)" }}>
            FORECASTING QUESTION
          </div>
          <div style={{ marginTop: 14, fontFamily: "var(--font-display)", fontSize: portrait ? 38 : 42, lineHeight: 1.12, color: "var(--ink)" }}>
            {data.question}
          </div>
          <div
            style={{
              marginTop: 22,
              display: "inline-block",
              opacity: tw(t, 1.4, 0.5),
              border: "1px solid var(--rule-strong)",
              borderRadius: 999,
              padding: "5px 14px",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--ink-2)",
            }}
          >
            asked to <span style={{ color: "var(--ink)", fontWeight: 600 }}>{data.modelLabel}</span>
          </div>
        </div>
      </foreignObject>

      {/* Network */}
      <g transform={`translate(${gx},${gy}) scale(${scale})`}>
        <g fill="none">
          {layout.edges.map((le) => {
            const e = edgeById.get(le.id);
            const draw = tw(t, 5.3 + (colOf.get(le.source) ?? 0) * 0.55 + 0.35, 0.5);
            if (draw <= 0) return null;
            const critical = e?.on_critical_path ?? false;
            const lit = ringTarget != null && (le.source === ringTarget || le.target === ringTarget);
            return (
              <path
                key={le.id}
                d={le.path}
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - draw}
                markerEnd={draw > 0.95 ? "url(#mv-arrow)" : undefined}
                style={{
                  stroke: critical && shade > 0.5 ? "var(--ink-2)" : "var(--ink-3)",
                  opacity: focusDim > 0 && !lit ? 1 - 0.55 * focusDim : 0.55 + 0.4 * (critical ? shade : 0),
                }}
                strokeWidth={critical ? 1.3 + 0.5 * shade : 1.2}
              />
            );
          })}
        </g>
        {layout.nodes.map((ln) => {
          const n = nodeById.get(ln.id);
          if (!n) return null;
          const a = reveal(ln.column);
          if (a <= 0) return null;
          const isOutcome = ln.isOutcome;
          const pct = isOutcome ? 0 : Math.round(shade * (n.betweenness / maxB) * 100);
          const dark = !isOutcome && pct > 55;
          const isRing = ringTarget === ln.id;
          const dim = focusDim > 0 && !isRing ? 1 - 0.5 * focusDim : 1;
          return (
            <g key={ln.id} opacity={a * dim} transform={`translate(0, ${(1 - a) * -8})`}>
              {isRing && ringOpacity > 0 && (
                <rect
                  x={ln.x - 5}
                  y={ln.y - 5}
                  width={ln.w + 10}
                  height={ln.h + 10}
                  rx={10}
                  fill="none"
                  strokeWidth={2.5}
                  style={{ stroke: "var(--accent)", opacity: ringOpacity }}
                />
              )}
              <rect
                x={ln.x}
                y={ln.y}
                width={ln.w}
                height={ln.h}
                rx={7}
                style={{
                  fill: isOutcome ? "var(--ink)" : `color-mix(in oklab, var(--seq-hi) ${pct}%, var(--seq-lo))`,
                  stroke: isOutcome ? "var(--ink)" : "color-mix(in oklab, var(--seq-hi) 35%, var(--rule))",
                }}
              />
              {isOutcome && (
                <text x={ln.x + 10} y={ln.y + 14} style={{ fill: "var(--paper)", fontFamily: "var(--font-sans)", fontSize: 9, letterSpacing: "0.1em", fontWeight: 600, opacity: 0.7 }}>
                  OUTCOME
                </text>
              )}
              {ln.lines.map((line, i) => (
                <text
                  key={i}
                  x={ln.x + 10}
                  y={ln.y + (isOutcome ? 27 : 18) + i * 15}
                  style={{
                    fill: isOutcome ? "var(--paper)" : dark ? "var(--seq-text-hi)" : "var(--ink)",
                    fontFamily: "var(--font-cond)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </g>

      {/* Panels */}
      <Panel box={panel} opacity={span(t, 4.8, 11.1)}>
        <Eyebrow>{data.modelLabel} forecast</Eyebrow>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 64, lineHeight: 1, marginTop: 8, color: "var(--ink)" }}>
          {Math.round(data.p0 * 100)}
          <span style={{ fontSize: 30, color: "var(--ink-3)" }}>%</span>
        </div>
        <div style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 4 }}>probability of “Yes”</div>
        <div style={{ marginTop: portrait ? 16 : 30, opacity: tw(t, 8.2, 0.6), fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          {factors.length} factors and {data.edges.length} causal links, each with a stated mechanism.
        </div>
      </Panel>

      <Panel box={panel} opacity={span(t, 11.3, 17.1)}>
        <Eyebrow>How central is each factor?</Eyebrow>
        <div style={{ marginTop: 14, display: "grid", gap: portrait ? 8 : 12 }}>
          {topFactors.map((n, i) => (
            <div key={n.node_id} style={{ opacity: tw(t, 11.8 + i * 0.3, 0.4) }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--ink)" }}>
                <span style={{ fontFamily: "var(--font-cond)" }}>{humanize(n.node_id)}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>{n.betweenness.toFixed(2)}</span>
              </div>
              <div style={{ marginTop: 5, height: 6, borderRadius: 99, background: "var(--surface-2)" }}>
                <div style={{ height: 6, borderRadius: 99, background: "var(--accent)", width: `${shade * (n.betweenness / maxB) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: portrait ? 10 : 18, fontSize: 13, lineHeight: 1.45, color: "var(--ink-3)" }}>
          Betweenness: the share of shortest paths in the network that pass through a factor.
        </div>
      </Panel>

      <Panel box={panel} opacity={span(t, 17.3, 25.1)}>
        <Eyebrow>Probe · strengthen a central factor</Eyebrow>
        <div style={{ marginTop: 8, fontFamily: "var(--font-cond)", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
          {central.targetId ? humanize(central.targetId) : "—"}
        </div>
        <div
          style={{
            marginTop: 8,
            opacity: tw(t, 17.8, 0.5),
            borderLeft: "2px solid var(--accent)",
            paddingLeft: 12,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 16,
            lineHeight: 1.4,
            color: "var(--ink)",
            display: "-webkit-box",
            WebkitLineClamp: portrait ? 2 : 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {central.text}
        </div>
        <ForecastMove p0={data.p0} p1={central.p1} t={t} start={20.6} portrait={portrait} />
      </Panel>

      <Panel box={panel} opacity={span(t, 25.3, 33.1)}>
        <Eyebrow>Three probes, same network</Eyebrow>
        <div style={{ marginTop: 14, display: "grid", gap: portrait ? 10 : 16 }}>
          {[
            { label: "Central factor", sub: central.targetId ? humanize(central.targetId) : "", p1: central.p1, at: 25.6 },
            { label: "Peripheral factor", sub: peripheral.targetId ? humanize(peripheral.targetId) : "", p1: peripheral.p1, at: 27.1 },
            { label: "Irrelevant information", sub: "control", p1: control.p1, at: 28.7 },
          ].map((row) => {
            const k = tw(t, row.at, 0.7);
            const d = row.p1 - data.p0;
            const maxShift = Math.max(0.05, Math.abs(central.p1 - data.p0), Math.abs(peripheral.p1 - data.p0));
            return (
              <div key={row.label} style={{ opacity: tw(t, row.at, 0.35) }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 15, color: "var(--ink)" }}>
                    {row.label} <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-cond)" }}>{row.sub}</span>
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: Math.abs(d) < 0.005 ? "var(--ink-3)" : d > 0 ? "var(--up)" : "var(--down)" }}>
                    {formatDelta(d * k)}
                  </span>
                </div>
                <div style={{ marginTop: 6, height: 8, borderRadius: 99, background: "var(--surface-2)" }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 99,
                      background: d >= 0 ? "var(--up)" : "var(--down)",
                      width: `${(Math.abs(d) / maxShift) * 100 * k}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel box={panel} opacity={tw(t, 33.3, 0.4)}>
        <Eyebrow>Structural sensitivity ratio</Eyebrow>
        <div style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          <div>average shift from probes on <b style={{ color: "var(--ink)", fontWeight: 600 }}>central</b> targets</div>
          <div style={{ height: 1, background: "var(--rule-strong)", margin: "6px 0" }} />
          <div>average shift from probes on <b style={{ color: "var(--ink)", fontWeight: 600 }}>peripheral</b> targets</div>
        </div>
        {data.ssr != null && (
          <div style={{ marginTop: portrait ? 10 : 18, opacity: tw(t, 34.6, 0.5), display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 44, color: "var(--accent)" }}>
              {(data.ssr * tw(t, 34.6, 1.2)).toFixed(2)}×
            </span>
            <span style={{ fontSize: 14, color: "var(--ink-3)" }}>for this run</span>
          </div>
        )}
        <div style={{ marginTop: portrait ? 8 : 16, opacity: tw(t, 36.4, 0.6), fontSize: 14, lineHeight: 1.45, color: "var(--ink-2)" }}>
          Above 1× means central targets moved the forecast more. The paper tests this across 116 questions and 7 models.
        </div>
      </Panel>

      {/* Caption */}
      <foreignObject x={caption.x} y={caption.y} width={caption.w} height={caption.h}>
        <div
          style={{
            opacity: span(t, CHAPTERS[chapterIndex].start, CHAPTERS[chapterIndex].end + 0.35, 0.3),
            fontFamily: "var(--font-sans)",
            fontSize: portrait ? 21 : 17,
            lineHeight: 1.4,
            color: "var(--ink-2)",
            borderTop: "1px solid var(--rule)",
            paddingTop: portrait ? 12 : 10,
          }}
        >
          {CHAPTERS[chapterIndex].caption(data)}
        </div>
      </foreignObject>
    </svg>
  );
}

function Panel({
  box,
  opacity,
  children,
}: {
  box: { x: number; y: number; w: number; h: number };
  opacity: number;
  children: React.ReactNode;
}) {
  if (opacity <= 0.001) return null;
  return (
    <foreignObject x={box.x} y={box.y} width={box.w} height={box.h} opacity={opacity}>
      <div style={{ fontFamily: "var(--font-sans)", color: "var(--ink)", height: "100%" }}>{children}</div>
    </foreignObject>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase", color: "var(--ink-3)" }}>
      {children}
    </div>
  );
}

function ForecastMove({ p0, p1, t, start, portrait }: { p0: number; p1: number; t: number; start: number; portrait: boolean }) {
  const k = tw(t, start + 0.5, 1.6);
  const p = p0 + (p1 - p0) * k;
  const hi = Math.min(1, Math.max(0.5, p1 + 0.1));
  const x = (v: number) => `${(v / hi) * 100}%`;
  const up = p1 >= p0;
  return (
    <div style={{ marginTop: portrait ? 10 : 22, opacity: tw(t, start, 0.4) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 14, color: "var(--ink-2)" }}>
        <span>Model answers again</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "var(--ink)" }}>
          {formatProbability(p0)} → <b style={{ color: up ? "var(--up)" : "var(--down)" }}>{formatProbability(Math.round(p * 100) / 100)}</b>
        </span>
      </div>
      <div style={{ position: "relative", height: 16, marginTop: 8 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 7, height: 2, background: "var(--rule-strong)" }} />
        <div style={{ position: "absolute", top: 0, width: 2, height: 16, background: "var(--ink-3)", left: x(p0) }} />
        <div
          style={{
            position: "absolute",
            top: 6,
            height: 4,
            borderRadius: 99,
            background: up ? "var(--up)" : "var(--down)",
            left: x(Math.min(p0, p)),
            width: `${(Math.abs(p - p0) / hi) * 100}%`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 1,
            width: 14,
            height: 14,
            marginLeft: -7,
            borderRadius: 99,
            background: up ? "var(--up)" : "var(--down)",
            left: x(p),
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
        <span>0%</span>
        <span>{Math.round(hi * 100)}%</span>
      </div>
    </div>
  );
}
