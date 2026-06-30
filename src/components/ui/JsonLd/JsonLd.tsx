import React from 'react';

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  // Escape `<` so a value containing `</script>` (or `<!--`) can't break out of
  // the script tag. JSON.stringify does NOT escape `<`, so this is the guard that
  // keeps structured-data injection from becoming XSS if user input ever flows in.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
