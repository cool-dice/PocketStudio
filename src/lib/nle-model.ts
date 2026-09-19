/** NLE-lite timeline stored as VideoProject.timeline JSON. */

export type NleTrackKind = "video" | "audio" | "titles";

export interface NleClip {
  id: string;
  artifactId: string;
  title: string;
  /** Start on the timeline, seconds. */
  start: number;
  /** In/out on the source, seconds. */
  inPoint: number;
  outPoint: number;
  url: string | null;
  type: "image" | "audio" | "video" | "scene";
  speed: number;
  lut: string | null;
  transition: "none" | "cut" | "dissolve" | "fade";
  kenBurns: boolean;
}

export interface NleTrack {
  id: string;
  name: string;
  kind: NleTrackKind;
  muted: boolean;
  volume: number;
  clips: NleClip[];
}

export interface NleTimeline {
  fps: number;
  tracks: NleTrack[];
}

export const DEFAULT_LUTS = [
  { id: "none", label: "Без LUT" },
  { id: "warm", label: "Тёплый" },
  { id: "cool", label: "Холодный" },
  { id: "bw", label: "Ч/б" },
  { id: "night", label: "Ночь" },
] as const;

export function emptyTimeline(fps = 24): NleTimeline {
  return {
    fps,
    tracks: [
      { id: "v1", name: "V1", kind: "video", muted: false, volume: 1, clips: [] },
      { id: "v2", name: "V2", kind: "video", muted: false, volume: 1, clips: [] },
      { id: "a1", name: "A1", kind: "audio", muted: false, volume: 1, clips: [] },
      { id: "a2", name: "A2", kind: "audio", muted: false, volume: 1, clips: [] },
      {
        id: "t1",
        name: "Титры",
        kind: "titles",
        muted: false,
        volume: 1,
        clips: [],
      },
    ],
  };
}

export function parseTimeline(raw: string): NleTimeline {
  try {
    const parsed = JSON.parse(raw) as Partial<NleTimeline>;
    if (parsed && Array.isArray(parsed.tracks) && parsed.tracks.length > 0) {
      return {
        fps: typeof parsed.fps === "number" ? parsed.fps : 24,
        tracks: parsed.tracks as NleTrack[],
      };
    }
  } catch {
    // fall through
  }
  return emptyTimeline();
}

export function timelineDuration(tl: NleTimeline): number {
  let max = 0;
  for (const track of tl.tracks) {
    for (const clip of track.clips) {
      const end = clip.start + Math.max(0, clip.outPoint - clip.inPoint) / (clip.speed || 1);
      if (end > max) max = end;
    }
  }
  return max;
}
