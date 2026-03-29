import { Component, createElement } from 'react';
import { Button } from './ui';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    // Reset error when route/children change (user navigated away)
    if (this.state.hasError && this.props.children !== prevProps.children) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleBackToDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Custom fallback
    if (this.props.fallback) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
        : this.props.fallback;
    }

    const lang = document.documentElement.lang || '';
    const isAr = lang.startsWith('ar');

    const labels = {
      title: isAr ? 'حدث خطأ غير متوقع' : 'Something went wrong',
      description: isAr
        ? 'حصل مشكلة أثناء تحميل هذا القسم. جرّب تاني أو ارجع للصفحة الرئيسية.'
        : 'An error occurred while loading this section. Try again or go back to the dashboard.',
      tryAgain: isAr ? 'حاول مرة أخرى' : 'Try Again',
      backToDashboard: isAr ? 'العودة للرئيسية' : 'Back to Dashboard',
    };

    // Compact mode for section-level boundaries
    if (this.props.compact) {
      return (
        <div
          className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-sm shrink-0 text-red-500 font-bold">
            !
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-content dark:text-content-dark text-sm m-0 font-medium">
              {labels.title}
            </p>
            {this.state.error?.message && (
              <p className="text-content-muted dark:text-content-muted-dark text-xs m-0 mt-1 truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={this.handleReset}>
            {labels.tryAgain}
          </Button>
        </div>
      );
    }

    // Page-level error UI
    return (
      <div
        className="flex items-center justify-center min-h-[50vh] flex-col gap-4 p-6"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="w-full max-w-md rounded-2xl bg-surface-card dark:bg-surface-card-dark border border-border dark:border-border-dark p-8 flex flex-col items-center gap-4 shadow-sm">
          {/* Error icon */}
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h2 className="text-content dark:text-content-dark m-0 text-lg font-semibold text-center">
            {labels.title}
          </h2>

          <p className="text-content-muted dark:text-content-muted-dark m-0 text-[13px] text-center leading-relaxed">
            {labels.description}
          </p>

          {this.state.error?.message && (
            <div className="w-full mt-1 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <p className="text-red-500 dark:text-red-400 text-xs m-0 font-mono break-all">
                {this.state.error.message}
              </p>
              {this.state.errorInfo?.componentStack && (
                <details className="mt-2">
                  <summary className="text-red-400 text-[10px] cursor-pointer">{isAr ? 'تفاصيل' : 'Details'}</summary>
                  <pre className="text-red-400/70 text-[9px] m-0 mt-1 max-h-[120px] overflow-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 500)}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <Button size="sm" onClick={this.handleReset}>
              {labels.tryAgain}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { window.location.href = '/dashboard'; window.location.reload(); }}>
              {labels.backToDashboard}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
