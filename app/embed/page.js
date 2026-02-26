import BrowserExperience from "@/components/Browser/BrowserExperience";

export default function EmbedPage({ searchParams }) {
  const docParam = searchParams?.doc;
  const defaultDocUrl =
    typeof docParam === "string" && docParam.trim()
      ? docParam.trim()
      : "/root.node";

  return <BrowserExperience defaultDocUrl={defaultDocUrl} hideBrowser addressBarHeight={0} />;
}

