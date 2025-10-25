import { useTwilightLinks } from "@/hooks/useTwilightLinks";

export default function App({ Component, pageProps }) {
  useTwilightLinks();
  return <Component {...pageProps} />;
}