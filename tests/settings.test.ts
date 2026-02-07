import { OpensidianSettings, DEFAULT_SETTINGS } from '../src/core/types/settings';

describe('Settings', () => {
  it('should have default settings', () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
    expect(DEFAULT_SETTINGS.model).toBe('auto');
    expect(DEFAULT_SETTINGS.permissionMode).toBe('safe');
  });

  it('should have all required settings fields', () => {
    const settings: OpensidianSettings = DEFAULT_SETTINGS;
    expect(settings.version).toBeDefined();
    expect(settings.userName).toBeDefined();
    expect(settings.theme).toBeDefined();
    expect(settings.excludedTags).toBeInstanceOf(Array);
  });
});
