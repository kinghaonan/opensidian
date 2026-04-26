import { ProviderCapabilities } from '../types';

export const OPENCODE_CAPABILITIES: ProviderCapabilities = {
  supportsStreaming: true,
  supportsThinking: true,
  supportsToolCall: true,
  supportsPersistentQuery: false,
  supportsImageAttachments: true,
  supportsPlanMode: true,
};
