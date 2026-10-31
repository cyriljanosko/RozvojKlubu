"use client";

import { useState } from "react";

import { Button, Modal } from "@/components/sfz";

interface ShareLabels {
  share: string;
  title: string;
  copy: string;
  copied: string;
  facebook: string;
  whatsapp: string;
  email: string;
  note: string;
  close: string;
}

/** "Zdieľať" with the post link: copy, Facebook, WhatsApp, e-mail (ADR 0023, point 8). */
export function ShareButton({
  url,
  title,
  labels,
}: {
  url: string;
  title: string;
  labels: ShareLabels;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const targets = [
    { label: labels.facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: labels.whatsapp, href: `https://wa.me/?text=${enc(`${title} ${url}`)}` },
    { label: labels.email, href: `mailto:?subject=${enc(title)}&body=${enc(url)}` },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {labels.share}
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setCopied(false);
        }}
        title={labels.title}
        footer={
          <Button variant="tertiary" onClick={() => setOpen(false)}>
            {labels.close}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <Button variant="primary" block icon={copied ? "check" : undefined} onClick={copy}>
            {copied ? labels.copied : labels.copy}
          </Button>
          {targets.map((t) => (
            <a
              key={t.label}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="sfz-btn sfz-btn--secondary sfz-btn--md sfz-btn--block no-underline"
            >
              <span className="sfz-btn__label">{t.label}</span>
            </a>
          ))}
          <p className="footnote text-(--ink-muted)" aria-live="polite">
            {labels.note}
          </p>
        </div>
      </Modal>
    </>
  );
}
