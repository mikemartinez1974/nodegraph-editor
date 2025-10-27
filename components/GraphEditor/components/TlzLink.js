// Create this as a new file: components/TlzLink.js
"use client";
import React from 'react';
import eventBus from '../../NodeGraph/eventBus';

export const TlzLink = ({ href, children, ...props }) => {
  // If no href, render children
  if (!href) return <a {...props}>{children}</a>;

  // SSR-safe render
  if (typeof window === 'undefined') {
    return <a href={href} {...props}>{children}</a>;
  }

  // Handle tlz:// links by emitting fetchUrl so the app fetches and loads the data
  if (href.startsWith('tlz://')) {
    const rest = href.slice('tlz://'.length);
    const firstSlash = rest.indexOf('/');
    let host = '';
    let path = '';

    if (firstSlash !== -1) {
      host = rest.slice(0, firstSlash);
      path = rest.slice(firstSlash); // includes leading '/'
    } else {
      path = '/' + rest;
    }

    const fullUrl = host ? `${window.location.protocol}//${host}${path}` : window.location.origin + path;

    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
       // Let the app handle fetching/loading the resource using the fetchable https URL
        eventBus.emit('fetchUrl', { url: fullUrl });
      } catch (err) {
        console.warn('TLZ fetch emit failed, falling back to full navigation', err);
        try { window.location.assign(fullUrl); } catch (err2) { console.warn('Full navigation failed', err2); }
      }
    };

    return (
      <a
        href={href}
        onClick={onClick}
        style={{
          color: 'rgb(25, 118, 210)',
          textDecoration: 'underline',
          cursor: 'pointer',
          pointerEvents: 'auto'
        }}
        {...props}
      >
        {children}
      </a>
    );
  }

  // Regular links open in new tab
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'rgb(25, 118, 210)',
        textDecoration: 'underline',
        pointerEvents: 'auto'
      }}
      {...props}
    >
      {children}
    </a>
  );
};
