import { Component, type ReactNode } from 'react';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Isolates one overlay. Without this, a render error anywhere unmounts the whole UI, which is how
 * the HUD used to vanish on zoom. Here only the broken panel is replaced, and "Retry" re-mounts it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.name}]`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="pointer-events-auto rounded-2xl border border-rose-500/30 bg-ink/80 px-4 py-3 text-xs text-rose-200 shadow-2xl backdrop-blur-xl">
        {this.props.name} hit a glitch.{' '}
        <button type="button" onClick={() => this.setState({ error: null })} className="underline underline-offset-2">
          Retry
        </button>
      </div>
    );
  }
}
