"use client";

/**
 * Fake deploy pipeline: steps flip Ожидает → В процессе → Готово
 * one by one via a setTimeout chain. All timers are tracked and
 * cleaned up on unmount / re-run; no network involved.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { PIPELINE_STEPS, type StepStatus } from "./deploy-data";

/** Per-step duration of the "В процессе" phase (ms). */
const STEP_DURATIONS = [1400, 900, 1300, 1600] as const;
const START_DELAY = 350;

export function useDeployPipeline() {
  const [statuses, setStatuses] = useState<StepStatus[]>(
    () => PIPELINE_STEPS.map(() => "idle") as StepStatus[],
  );
  const [running, setRunning] = useState(false);

  const timers = useRef<number[]>([]);
  const mounted = useRef(true);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const start = useCallback(() => {
    if (running) return;
    clearTimers();
    setStatuses(PIPELINE_STEPS.map(() => "idle") as StepStatus[]);
    setRunning(true);

    let at = START_DELAY;
    PIPELINE_STEPS.forEach((_, i) => {
      const stepStart = at;
      const stepEnd = at + STEP_DURATIONS[i];
      timers.current.push(
        window.setTimeout(() => {
          if (!mounted.current) return;
          setStatuses((prev) =>
            prev.map((s, j) => (j === i && s !== "done" ? "running" : s)),
          );
        }, stepStart),
      );
      timers.current.push(
        window.setTimeout(() => {
          if (!mounted.current) return;
          setStatuses((prev) =>
            prev.map((s, j) => (j === i ? "done" : s)),
          );
        }, stepEnd),
      );
      at = stepEnd + 120;
    });

    timers.current.push(
      window.setTimeout(() => {
        if (!mounted.current) return;
        setRunning(false);
      }, at + 200),
    );
  }, [clearTimers, running]);

  return { statuses, running, start };
}
