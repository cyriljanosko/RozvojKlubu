"use client";

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
    <div className="relative aspect-video w-full overflow-hidden rounded-(--radius-lg) bg-(--surface-raised)">
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
          <span className="flex size-14 items-center justify-center rounded-full bg-(--brand-blue) text-(--on-brand) transition-transform group-hover:scale-105">
            <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="headline">{playLabel}</span>
          <span className="footnote max-w-sm text-(--ink-muted)">{note}</span>
        </button>
      )}
    </div>
  );
}
