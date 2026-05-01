// Web Components served from the main marketing site
// (https://cethos.com/embed/cethos-components.js). React renders these as
// custom elements; the actual implementation lives in the main_web repo.
//
// React 19's types live under `React.JSX`, not the global `JSX`, so we
// augment that namespace to teach TypeScript about the custom elements.

import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type CethosHeaderProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  'current-site'?: string
  'hide-cta'?: boolean | ''
  theme?: 'light' | 'dark'
}

type CethosFooterProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  minimal?: boolean | ''
  'hide-locations'?: boolean | ''
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'cethos-header': CethosHeaderProps
      'cethos-footer': CethosFooterProps
    }
  }
}

export {}
