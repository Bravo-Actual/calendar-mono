'use client';

import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';
import { isValidElement, memo } from 'react';
import { type Options } from 'react-markdown';
import { Streamdown } from 'streamdown';
import { CodeBlock, CodeBlockCopyButton } from './code-block';

export type ResponseProps = HTMLAttributes<HTMLDivElement> & {
  options?: Options;
  children: Options['children'];
};

const components: Options['components'] = {
  ol: ({ children, className, ...props }) => (
    <ol className={cn('ml-4 list-outside list-decimal', className)} {...props}>
      {children}
    </ol>
  ),
  li: ({ children, className, ...props }) => (
    <li className={cn('py-1', className)} {...props}>
      {children}
    </li>
  ),
  ul: ({ children, className, ...props }) => (
    <ul className={cn('ml-4 list-outside list-disc', className)} {...props}>
      {children}
    </ul>
  ),
  p: ({ children, className, ...props }) => (
    <p className={cn('mt-4 first:mt-1', className)} {...props}>
      {children}
    </p>
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn('my-6 border-border', className)} {...props} />
  ),
  strong: ({ children, className, ...props }) => (
    <span className={cn('font-semibold', className)} {...props}>
      {children}
    </span>
  ),
  a: ({ children, className, ...props }) => (
    <a
      className={cn('font-medium text-primary underline', className)}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ children, className, ...props }) => (
    <h1
      className={cn('mt-6 mb-2 font-semibold text-3xl', className)}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, className, ...props }) => (
    <h2
      className={cn('mt-6 mb-2 font-semibold text-2xl', className)}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, className, ...props }) => (
    <h3 className={cn('mt-6 mb-2 font-semibold text-xl', className)} {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, className, ...props }) => (
    <h4 className={cn('mt-6 mb-2 font-semibold text-lg', className)} {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, className, ...props }) => (
    <h5
      className={cn('mt-6 mb-2 font-semibold text-base', className)}
      {...props}
    >
      {children}
    </h5>
  ),
  h6: ({ children, className, ...props }) => (
    <h6 className={cn('mt-6 mb-2 font-semibold text-sm', className)} {...props}>
      {children}
    </h6>
  ),
  table: ({ children, className, ...props }) => (
    <div className="my-4 overflow-x-auto min-w-0 max-w-full">
      <table
        className={cn('min-w-full border-collapse border border-border', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, className, ...props }) => (
    <thead className={cn('bg-muted/50', className)} {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, className, ...props }) => (
    <tbody className={cn('divide-y divide-border', className)} {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, className, ...props }) => (
    <tr className={cn('border-border border-b', className)} {...props}>
      {children}
    </tr>
  ),
  th: ({ children, className, ...props }) => (
    <th
      className={cn('px-4 py-2 text-left font-semibold text-sm', className)}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, className, ...props }) => (
    <td className={cn('px-4 py-2 text-sm', className)} {...props}>
      {children}
    </td>
  ),
  blockquote: ({ children, className, ...props }) => (
    <blockquote
      className={cn(
        'my-4 border-muted-foreground/30 border-l-4 pl-4 text-muted-foreground italic',
        className
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ node, className, ...props }) => {
    const inline = node?.position?.start.line === node?.position?.end.line;

    if (!inline) {
      return <code className={className} {...props} />;
    }

    return (
      <code
        className={cn(
          'rounded bg-muted px-1.5 py-0.5 font-mono text-sm',
          className
        )}
        {...props}
      />
    );
  },
  pre: ({ node, className, children }) => {
    let language = 'javascript';

    if (typeof node?.properties?.className === 'string') {
      language = node.properties.className.replace('language-', '');
    }

    // Extract code content from children safely
    let code = '';
    if (
      isValidElement(children) &&
      children.props &&
      typeof (children.props as Record<string, unknown>).children === 'string'
    ) {
      code = (children.props as Record<string, unknown>).children as string;
    } else if (typeof children === 'string') {
      code = children;
    }

    return (
      <CodeBlock
        className={cn('my-4 h-auto', className)}
        code={code}
        language={language}
      >
        <CodeBlockCopyButton />
      </CodeBlock>
    );
  },
};

export const Response = memo(
  ({
    className,
    options,
    children,
    ...props
  }: ResponseProps) => {
    return (
      <div
        className={cn(
          'w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          // Ensure embedded content uses full width but doesn't overflow
          'min-w-0 max-w-full',
          className
        )}
        {...props}
      >
        <Streamdown
          components={components}
          {...options}
        >
          {children}
        </Streamdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';