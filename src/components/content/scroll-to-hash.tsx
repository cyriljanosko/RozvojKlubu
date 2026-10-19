"use client";

import { useEffect } from "react";

/** Scrolls to the #anchor once streamed content is in the page (the browser jumps too early). */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
