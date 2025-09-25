'use client';

import { getAvatarUrl } from '@/lib/avatar-utils';
import {
  Message,
  MessageContent,
  MessageAvatar,
  Response,
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai';
import type { UIMessagePart, UIToolInvocation } from 'ai';

interface MessageRendererProps {
  message: any;
  messageIndex: number;
  selectedPersona: any;
  profile: any;
  user: any;
}

export function MessageRenderer({
  message,
  messageIndex,
  selectedPersona,
  profile,
  user
}: MessageRendererProps) {
  const messagePersona = message.role === 'assistant' ? selectedPersona : null;

  return (
    <div key={`${message.id}-${messageIndex}`}>
      <Message from={message.role}>
        <MessageAvatar
          src={message.role === 'assistant'
            ? getAvatarUrl(messagePersona?.avatar_url) || ""
            : getAvatarUrl(profile?.avatar_url) || ""}
          name={message.role === 'user'
            ? (profile?.display_name || user?.email?.split('@')[0] || 'You')
            : (messagePersona?.name || 'AI')}
        />
        <MessageContent>
          {/* Render all parts in order */}
          {message.parts?.map((part: any, i: number) => {
            if (part.type === 'text') {
              return (
                <div key={`text-${i}`} className="mt-1">
                  <Response>{part.text}</Response>
                </div>
              );
            }
            if (part.type === 'tool-call') {
              return (
                <div key={`tool-call-${i}`} className="mt-1">
                  <Tool>
                    <ToolHeader
                      type={part.toolName || 'Tool'}
                      state={part.state || 'input-available'}
                    />
                    <ToolContent>
                      <ToolInput input={part.args || part.input || {}} />
                    </ToolContent>
                  </Tool>
                </div>
              );
            }
            if (part.type === 'tool-result') {
              return (
                <div key={`tool-result-${i}`} className="mt-1">
                  <Tool>
                    <ToolHeader
                      type={part.toolName || 'Tool'}
                      state={part.errorText ? 'output-error' : 'output-available'}
                    />
                    <ToolContent>
                      {part.args && <ToolInput input={part.args} />}
                      <ToolOutput
                        output={part.result || part.output}
                        errorText={part.errorText}
                      />
                    </ToolContent>
                  </Tool>
                </div>
              );
            }
            if (part.type === 'tool-invocation') {
              return (
                <div key={`tool-invocation-${i}`} className="mt-1">
                  <Tool>
                    <ToolHeader
                      type={part.toolInvocation?.toolName || 'Tool'}
                      state={part.toolInvocation?.state || 'result'}
                    />
                    <ToolContent>
                      {part.toolInvocation?.args && <ToolInput input={part.toolInvocation.args} />}
                      {part.toolInvocation?.result && (
                        <ToolOutput
                          output={part.toolInvocation.result}
                          errorText={part.toolInvocation.error}
                        />
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }
            // Skip reasoning and other internal parts
            return null;
          })}

          {/* Handle toolInvocations from streaming */}
          {message.toolInvocations?.map((toolInvocation: any, i: number) => (
            <div key={`streaming-tool-${i}`} className="mt-1">
              <Tool>
                <ToolHeader
                  type={toolInvocation.toolName}
                  state={toolInvocation.state}
                />
                <ToolContent>
                  {toolInvocation.args && <ToolInput input={toolInvocation.args} />}
                  {toolInvocation.result && (
                    <ToolOutput
                      output={toolInvocation.result}
                      errorText={toolInvocation.error}
                    />
                  )}
                </ToolContent>
              </Tool>
            </div>
          ))}

          {/* Fallback for legacy content */}
          {!message.parts && message.content && (
            <Response>{typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}</Response>
          )}
        </MessageContent>
      </Message>
    </div>
  );
}