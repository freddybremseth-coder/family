import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { RealtyflowOverviewCard } from './RealtyflowOverviewCard';

interface Props {
  children: React.ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[AppErrorBoundary]', this.props.label || 'område', error?.message, info?.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.label !== this.props.label && this.state.hasError) this.setState({ hasError: false });
  }

  renderContent() {
    if (this.props.label === 'Oversikt') {
      return (
        <div className="space-y-6">
          <RealtyflowOverviewCard />
          {this.props.children}
        </div>
      );
    }
    return this.props.children;
  }

  render() {
    if (!this.state.hasError) return this.renderContent();
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Kunne ikke vise {this.props.label || 'denne delen'} akkurat nå</h2>
            <p className="mt-1 text-sm text-red-700">En del av visningen feilet, men resten av appen skal fortsatt fungere.</p>
            <button onClick={() => this.setState({ hasError: false })} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
              <RefreshCw className="h-4 w-4" /> Prøv igjen
            </button>
          </div>
        </div>
      </div>
    );
  }
}
