import { useEffect, useMemo, useState } from 'react';
import mermaidScriptUrl from 'mermaid/dist/mermaid.min.js?url';

type MermaidRenderResult = {
  readonly svg: string;
};

type MermaidRuntime = {
  readonly initialize: (options: {
    readonly startOnLoad: boolean;
    readonly securityLevel: 'strict';
    readonly theme: 'dark' | 'default';
  }) => void;
  readonly render: (id: string, chart: string) => Promise<MermaidRenderResult>;
};

declare global {
  interface Window {
    mermaid?: MermaidRuntime;
    wikiMermaidLoader?: Promise<MermaidRuntime>;
  }
}

type MermaidDiagramProps = {
  readonly chart: string;
  readonly diagramId: string;
};

type RenderState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ready'; readonly svg: string }
  | { readonly kind: 'error'; readonly message: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown Mermaid render error';
}

function currentColorScheme(): 'dark' | 'light' {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function loadMermaidRuntime(): Promise<MermaidRuntime> {
  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }
  if (window.wikiMermaidLoader) {
    return window.wikiMermaidLoader;
  }

  window.wikiMermaidLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = mermaidScriptUrl;
    script.onload = () => {
      if (window.mermaid) {
        resolve(window.mermaid);
        return;
      }
      reject(new Error('Mermaid runtime did not register on window.'));
    };
    script.onerror = () => reject(new Error('Failed to load Mermaid runtime asset.'));
    document.head.append(script);
  });

  return window.wikiMermaidLoader;
}

export function MermaidDiagram({ chart, diagramId }: MermaidDiagramProps) {
  const [colorScheme, setColorScheme] = useState(currentColorScheme);
  const [state, setState] = useState<RenderState>({ kind: 'pending' });
  const renderId = useMemo(() => `wiki-mermaid-${diagramId}`, [diagramId]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const updateScheme = () => setColorScheme(currentColorScheme());
    query.addEventListener('change', updateScheme);
    return () => query.removeEventListener('change', updateScheme);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      setState({ kind: 'pending' });
      try {
        const mermaid = await loadMermaidRuntime();
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: colorScheme === 'dark' ? 'dark' : 'default',
        });
        const result = await mermaid.render(renderId, chart);
        if (!cancelled) {
          setState({ kind: 'ready', svg: result.svg });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ kind: 'error', message: errorMessage(error) });
        }
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, colorScheme, renderId]);

  if (state.kind === 'ready') {
    return (
      <figure className="mermaidDiagram">
        <figcaption>mermaid</figcaption>
        <div className="mermaidDiagramViewport" dangerouslySetInnerHTML={{ __html: state.svg }} />
      </figure>
    );
  }

  if (state.kind === 'error') {
    return (
      <figure className="codeBlock mermaidBlock mermaidFallback">
        <figcaption>mermaid render failed: {state.message}</figcaption>
        <pre>
          <code className="language-mermaid">{chart}</code>
        </pre>
      </figure>
    );
  }

  return (
    <figure className="mermaidDiagram">
      <figcaption>mermaid</figcaption>
      <div className="mermaidDiagramViewport">Rendering diagram...</div>
    </figure>
  );
}
