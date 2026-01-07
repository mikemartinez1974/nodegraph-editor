import React, { useEffect } from "react";
import { useTwiliteLinks } from "@/hooks/useTwiliteLinks";

export default function App({ Component, pageProps }) {
  useTwiliteLinks();
  useEffect(() => {
    const origWarn = console.warn;
    const filteredWarn = (...args) => {
      const msg = args && args.length ? String(args[0]) : '';
      if (
        typeof msg === 'string' &&
        (msg.includes('allow-scripts and allow-same-origin for its sandbox attribute') ||
          msg.includes('message channel closed before a response was received'))
      ) {
        return;
      }
      return origWarn(...args);
    };
    console.warn = filteredWarn;
    return () => {
      console.warn = origWarn;
    };
  }, []);
  return <Component {...pageProps} />;
}
