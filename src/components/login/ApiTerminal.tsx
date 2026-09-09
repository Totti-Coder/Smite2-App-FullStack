'use client';

import { useEffect, useState } from 'react';

// Deliberately NOT pretending to hit an official Smite 2 API - there isn't
// one (see the earlier research this session: Hi-Rez has no public Smite 2
// API yet). This is a log of what the app itself actually does under the
// hood - the OCR/icon-matching pipeline, the calibration system, the Steam
// player-count poller - dressed up as a live console. True, and more
// distinctive than a generic "fetching data..." trope.
type LogLine = { text: string; tone: 'prompt' | 'ok' | 'info' };

const LINES: LogLine[] = [
  { text: 'smite2-tracker --status', tone: 'prompt' },
  { text: 'conectado a Supabase', tone: 'ok' },
  { text: 'calibración de escaneo cargada (v4)', tone: 'info' },
  { text: 'hash perceptual: 88 dioses · 252 items · 5 roles', tone: 'info' },
  { text: 'API pública de Steam: jugadores activos consultados', tone: 'ok' },
  { text: 'esperando próxima captura...', tone: 'info' },
];

const CHAR_MS = 18;
const LINE_PAUSE_MS = 450;
const LOOP_PAUSE_MS = 2400;

const TONE_STYLE: Record<LogLine['tone'], { prefix: string; color: string }> = {
  prompt: { prefix: '$ ', color: 'text-ss-cyan' },
  ok: { prefix: '✓ ', color: 'text-ss-win' },
  info: { prefix: '  ', color: 'text-ss-text-secondary' },
};

export function ApiTerminal() {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time reduced-motion bailout: show the final state instantly instead of typing it out
      setLineIdx(LINES.length - 1);
      setCharIdx(LINES[LINES.length - 1].text.length);
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    function tick(li: number, ci: number) {
      if (cancelled) return;
      const line = LINES[li];
      if (ci < line.text.length) {
        setLineIdx(li);
        setCharIdx(ci + 1);
        setCursorOn(true);
        timeout = setTimeout(() => tick(li, ci + 1), CHAR_MS);
      } else if (li + 1 < LINES.length) {
        timeout = setTimeout(() => tick(li + 1, 0), LINE_PAUSE_MS);
      } else {
        setCursorOn(false);
        timeout = setTimeout(() => tick(0, 0), LOOP_PAUSE_MS);
      }
    }
    timeout = setTimeout(() => tick(0, 0), 500);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="glass-panel w-full max-w-md rounded-xl">
      <div className="flex items-center gap-1.5 border-b border-ss-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-ss-loss/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-ss-orange/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-ss-win/70" />
        <span className="ml-2 text-[11px] text-ss-text-muted">smite2-tracker — console</span>
      </div>
      <div className="min-h-[172px] p-4 font-mono text-[12.5px] leading-relaxed">
        {LINES.map((line, i) => {
          if (i > lineIdx) return null;
          const style = TONE_STYLE[line.tone];
          const text = i === lineIdx ? line.text.slice(0, charIdx) : line.text;
          return (
            <div key={i} className={`flex gap-1 ${style.color}`}>
              <span className="select-none opacity-70">{style.prefix}</span>
              <span>{text}</span>
              {i === lineIdx && cursorOn && <span className="animate-pulse text-ss-cyan">▍</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
