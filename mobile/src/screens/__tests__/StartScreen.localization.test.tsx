import { render, screen } from '@testing-library/react-native';

import StartScreen from '../StartScreen';

// The screen must render whatever tr.ts provides: if the text were hard-coded in the component,
// these replaced values would not appear.
jest.mock('../../localization/tr', () => ({
  tr: {
    start: {
      title: 'Değiştirilmiş başlık',
      description: 'Değiştirilmiş açıklama',
    },
  },
}));

describe('StartScreen localization', () => {
  it('shows the values from tr.ts, not hard-coded text', () => {
    render(<StartScreen />);

    expect(screen.getByRole('header', { name: 'Değiştirilmiş başlık' })).toBeTruthy();
    expect(screen.getByText('Değiştirilmiş açıklama')).toBeTruthy();
    expect(screen.queryByText('City Radar')).toBeNull();
  });
});
