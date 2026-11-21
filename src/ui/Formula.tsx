import katex from 'katex';
import { useMemo } from 'react';

interface FormulaProps {
  latex: string;
  block?: boolean;
  className?: string;
}

export function Formula({ latex, block = false, className }: FormulaProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: block,
        strict: false,
        output: 'htmlAndMathml',
      });
    } catch {
      return null;
    }
  }, [latex, block]);

  if (html === null) {
    return <code className="formula-fallback">{latex}</code>;
  }

  return (
    <span
      className={block ? `formula formula-block ${className ?? ''}` : `formula ${className ?? ''}`}
      // KaTeX returns sanitised markup built from a trusted, static knowledge base string.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}