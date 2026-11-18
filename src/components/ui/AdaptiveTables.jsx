import { useEffect } from "react";

import { enhanceAdaptiveTables } from "../../lib/adaptiveTableLabels";

// Install once per app. The observer watches list changes only, never changing
// React-owned content or attaching event handlers to individual rows.
const AdaptiveTables = () => {
  useEffect(() => {
    let frame = null;
    const update = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        enhanceAdaptiveTables();
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.getElementById("root") || document.body, {
      childList: true, subtree: true,
    });
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
};

export default AdaptiveTables;
