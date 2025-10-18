import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Reload the page to reset app state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              Thinking Space encountered an unexpected error. Don't worry - your
              data is safe.
            </p>

            {/* Error Details */}
            <details className="mb-6">
              <summary className="cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-2">
                Show error details
              </summary>
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-64">
                <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  <strong>Error:</strong> {this.state.error?.toString()}
                  {"\n\n"}
                  <strong>Stack:</strong>
                  {"\n"}
                  {this.state.error?.stack}
                  {this.state.errorInfo && (
                    <>
                      {"\n\n"}
                      <strong>Component Stack:</strong>
                      {"\n"}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </div>
            </details>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Reload Application
              </button>
              <button
                onClick={() => {
                  const errorText = `Error: ${this.state.error?.toString()}\n\nStack: ${this.state.error?.stack}`;
                  navigator.clipboard.writeText(errorText);
                  alert("Error details copied to clipboard");
                }}
                className="px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Copy Error
              </button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
              If this error persists, please report it on{" "}
              <a
                href="https://github.com/unforced/thinking-space/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                GitHub
              </a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
