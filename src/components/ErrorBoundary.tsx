import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[App ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#070B14] px-6 text-center text-white">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-500/25 bg-[#0D1526] p-6 shadow-2xl">
            <h1 className="font-display text-xl font-extrabold text-white">
              Something needs a quick refresh
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              OG VELOCITY recovered from an unexpected display hiccup. Tap below to reload cleanly — your session and data remain safe.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 py-2.5 text-xs font-black text-slate-950 shadow-lg hover:brightness-105"
            >
              Reload OG VELOCITY
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
