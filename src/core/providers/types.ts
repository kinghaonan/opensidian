export type ProviderId = string;

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsThinking: boolean;
  supportsToolCall: boolean;
  supportsPersistentQuery: boolean;
  supportsImageAttachments: boolean;
  supportsPlanMode: boolean;
}
