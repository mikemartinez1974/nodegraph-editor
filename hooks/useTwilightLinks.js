import { useEffect } from "react";
import { useRouter } from "next/router";

export function useTwilightLinks() {
  const router = useRouter();

  useEffect(() => {
    function handleClick(e) {
      const target = e.target.closest("a");
      if (target && target.tagName === "A") {
        const href = target.getAttribute("href");
        if (href && href.startsWith("tlz://")) {
          e.preventDefault();

          // Parse the path from the `tlz://` link
          const path = href.replace("tlz://cpwith.me", "");

          // Route internally or trigger custom logic
          if (path.endsWith(".node")) {
            // Handle .nodegraph files
            router.push(`/twilight${path}`);
          } else {
            console.warn("Unhandled tlz:// path:", path);
          }
        }
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [router]);
}