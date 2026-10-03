import { render, screen } from '@testing-library/react-native';

import { tr } from '../../localization/tr';
import StartScreen from '../StartScreen';

describe('StartScreen', () => {
  it('shows the app title and description from tr.ts', () => {
    render(<StartScreen />);

    expect(screen.getByRole('header', { name: tr.start.title })).toBeTruthy();
    expect(screen.getByText(tr.start.description)).toBeTruthy();
  });

  it('makes no network request while rendering', () => {
    const fetchMock = jest.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    try {
      render(<StartScreen />);

      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
