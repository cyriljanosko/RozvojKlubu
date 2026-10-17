"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * YouTube video that loads only after a click: nothing is requested from YouTube before that
 * (privacy, speed); then the no-cookie player starts.
 */
export function YouTubeVideo({
  videoId,
  title,
  playLabel,
  note,
}: {
  videoId: string;
  title: string;
  playLabel: string;
  note: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-xl border">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center"
        >
          <span className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-full transition-transform group-hover:scale-105">
            <Play aria-hidden className="ml-1 size-7" />
          </span>
          <span className="font-semibold">{playLabel}</span>
          <span className="text-muted-foreground max-w-sm text-xs">{note}</span>
        </button>
      )}
    </div>
  );
}
