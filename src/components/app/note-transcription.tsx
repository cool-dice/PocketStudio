"use client";

/**
 * Shared «Расшифровка» block: original ASR beside edited rawText.
 * Hidden when transcription is empty, a stub, or identical to the note.
 */

import { shouldShowTranscription } from "@/lib/voice-copy";

export function NoteTranscriptionBlock({
  rawText,
  transcription,
}: {
  rawText: string | null | undefined;
  transcription: string | null | undefined;
}) {
  if (!shouldShowTranscription(rawText, transcription)) return null;

  return (
    <section
      aria-label="Расшифровка"
      className="mt-3 rounded-xl border border-dashed bg-muted/30 p-3"
    >
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Расшифровка
      </h4>
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {transcription}
      </p>
    </section>
  );
}
