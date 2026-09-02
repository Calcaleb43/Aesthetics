"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FaqAccordion({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={`${item.question}-${index}`} className="faq-item">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-4 py-5 text-left"
              onClick={() => setOpen(isOpen ? null : index)}
              aria-expanded={isOpen}
            >
              <span className="text-[1.02rem] font-medium leading-snug">{item.question}</span>
              <ChevronDown
                className={`mt-1 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                size={18}
              />
            </button>
            <div
              className={`faq-answer grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="pb-6 text-[0.98rem] leading-7 text-[var(--ink-soft)] whitespace-pre-wrap">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
