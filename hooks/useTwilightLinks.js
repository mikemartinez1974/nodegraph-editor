import { useEffect } from "react";
import { useRouter } from "next/router";

export function useTwilightLinks() {
  const router = useRouter();

  useEffect(() => {
    const navigateTo = (targetUrl) => {
      try {
        // Navigate to the URL within your app's routing system
        router.push(targetUrl).catch(() => {
          try { 
            window.location.assign(targetUrl); 
          } catch (err) { 
            console.warn('TLZ fallback navigation failed', err); 
          }
        });
      } catch (err) {
        try { 
          window.location.assign(targetUrl); 
        } catch (err2) { 
          console.warn('TLZ navigation failed', err, err2); 
        }
      }
    };

    const extractTargetUrl = (href) => {
      if (!href || !href.startsWith('tlz://')) return null;
      
      // Strip the tlz:// protocol and keep everything else (domain + path)
      let targetUrl = href.slice('tlz://'.length);
      
      try { 
        targetUrl = decodeURIComponent(targetUrl); 
      } catch (err) { 
        /* ignore decode errors */ 
      }
      
      return targetUrl;
    };

    // Transform tlz:// links to prevent browser navigation
    const transformTlzLinks = () => {
      document.querySelectorAll('a[href^="tlz://"]').forEach(anchor => {
        const href = anchor.getAttribute('href');
        // Move href to data attribute so browser doesn't navigate
        anchor.setAttribute('data-tlz-href', href);
        anchor.removeAttribute('href');
        // Make it look like a link
        anchor.style.cursor = 'pointer';
        if (!anchor.style.color) anchor.style.color = 'rgb(0, 0, 238)'; // default link blue
        if (!anchor.style.textDecoration) anchor.style.textDecoration = 'underline';
        // Mark as transformed
        anchor.setAttribute('data-tlz-transformed', 'true');
      });
    };

    // Watch for new links being added to the page
    const observer = new MutationObserver(() => {
      transformTlzLinks();
    });
    
    // Start watching the document for changes
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Transform any existing links
    transformTlzLinks();

    function handleClick(e) {
      const anchor = e.target && e.target.closest && e.target.closest('a[data-tlz-href]');
      if (!anchor) return;

      e.preventDefault();
      e.stopPropagation();

      const href = anchor.getAttribute('data-tlz-href');
      const targetUrl = extractTargetUrl(href);
      if (!targetUrl) return;
      
      navigateTo(targetUrl);
    }

    function handleAuxClick(e) {
      const anchor = e.target && e.target.closest && e.target.closest('a[data-tlz-href]');
      if (!anchor) return;

      e.preventDefault();
      e.stopPropagation();

      const href = anchor.getAttribute('data-tlz-href');
      const targetUrl = extractTargetUrl(href);
      if (!targetUrl) return;

      navigateTo(targetUrl);
    }

    document.addEventListener('click', handleClick, true);
    document.addEventListener('auxclick', handleAuxClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('auxclick', handleAuxClick, true);
    };
  }, [router]);
}