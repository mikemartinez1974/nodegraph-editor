import React from "react";
import { Box, Typography } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';


export default function MarkdownRenderer({ content }) {
  if (!content)
    return <Typography color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'left' }}>Click to edit...</Typography>;

  return (
    <Box
      sx={{
        textAlign: 'left', // Ensure everything is left-aligned
        '& h1': { fontSize: '1.5rem', fontWeight: 'bold', mb: 1, mt: 2, textAlign: 'left' },
        '& h2': { fontSize: '1.25rem', fontWeight: 'bold', mb: 1, mt: 1.5, textAlign: 'left' },
        '& h3': { fontSize: '1.1rem', fontWeight: 'bold', mb: 1, mt: 1.5, textAlign: 'left' },
        '& p': { mb: 1, lineHeight: 1.6, textAlign: 'left' },
        '& pre': { mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, fontSize: '0.875rem', overflow: 'auto', textAlign: 'left' },
        '& code': { fontSize: '0.875rem', bgcolor: 'action.hover', px: 0.5, py: 0.25, borderRadius: 0.5, fontFamily: 'monospace' },
        '& pre code': { bgcolor: 'transparent', p: 0, textAlign: 'left' },
        '& strong': { fontWeight: 'bold' },
        '& em': { fontStyle: 'italic' },
        '& a': { color: 'primary.main', textDecoration: 'underline', '&:hover': { color: 'primary.dark' } },
        '& ul, & ol': { mb: 1, pl: 2, textAlign: 'left', '& li': { mb: 0.5 } },
        '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', pl: 2, ml: 0, fontStyle: 'italic', bgcolor: 'action.hover', py: 1, mb: 1, textAlign: 'left' },
        '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 2 },
        '& table': { width: '100%', borderCollapse: 'collapse', mb: 1, textAlign: 'left', '& th, & td': { border: '1px solid', borderColor: 'divider', p: 1, textAlign: 'left' }, '& th': { bgcolor: 'action.hover', fontWeight: 'bold' } }
      }}
    >
      <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={{
            a: ({ href, children, ...props }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                </a>
            ),
          }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
