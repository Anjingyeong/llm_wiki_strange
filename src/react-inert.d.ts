import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    readonly inert?: boolean | undefined;
  }
}
