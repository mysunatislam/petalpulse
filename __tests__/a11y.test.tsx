import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PainScale } from '../src/components/PainScale';
import { MoodPicker } from '../src/components/Mood';
import { BodyMap } from '../src/components/BodyMap';
import { Toggle, Button } from '../src/components/ui';
import { light } from '../src/theme/tokens';

function luminance(hex: string) {
  const c = hex.replace('#', '').match(/.{2}/g)!.map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('accessibility basics', () => {
  test('text colours meet WCAG AA on their backgrounds', () => {
    expect(contrast(light.text, light.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.textMuted, light.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.textSoft, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.textSoft, light.blush)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.textMuted, light.lavender)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.accentText, light.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.primaryText, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.danger, light.dangerBg)).toBeGreaterThanOrEqual(4.5);
  });

  test('pain scale exposes every value with words to screen readers', async () => {
    const onChange = jest.fn();
    await render(<PainScale value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('7, Hard to do daily things'));
    expect(onChange).toHaveBeenCalledWith(7);
    expect(screen.getByLabelText('Pain intensity, 0 to 10')).toBeTruthy();
  });

  test('mood picker items are labelled radios', async () => {
    const onChange = jest.fn();
    await render(<MoodPicker value="happy" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    await fireEvent.press(screen.getByLabelText('Overwhelmed'));
    expect(onChange).toHaveBeenCalledWith('overwhelmed');
  });

  test('body map works without tapping the drawing', async () => {
    const onToggle = jest.fn();
    await render(<BodyMap selected={[]} onToggle={onToggle} />);
    await fireEvent.press(screen.getByLabelText('Lower abdomen'));
    expect(onToggle).toHaveBeenCalledWith('lower_abdomen');
  });

  test('toggles announce state and buttons respect disabled', async () => {
    const onChange = jest.fn();
    const onPress = jest.fn();
    await render(
      <>
        <Toggle label="Reduce motion" value={false} onChange={onChange} />
        <Button title="Save" onPress={onPress} disabled />
      </>,
    );
    const sw = screen.getByRole('switch');
    expect(sw.props.accessibilityState).toEqual({ checked: false });
    await fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
