"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export default function SiteTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div key={pathname} className={`page-shell ${visible ? "page-shell-enter" : "page-shell-exit"}`}>
      {children}
    </div>
  );
}
