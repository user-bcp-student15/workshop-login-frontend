import { describe, expect, it } from 'vitest';
import { httpErrorMessage } from './http-error';

describe('httpErrorMessage', () => {
  it.each([
    [null, 'Fallback'],
    [undefined, 'Fallback'],
    ['rejection', 'Fallback'],
    [{}, 'Fallback'],
    [{ message: 'Transport' }, 'Transport'],
    [{ response: { data: { message: 'Backend' } }, message: 'Transport' }, 'Backend'],
    [{ response: { data: { message: '' } }, message: 'Transport' }, 'Transport']
  ])('preserves source precedence', (error, expected) => {
    expect(httpErrorMessage(error, 'message', 'Fallback')).toBe(expected);
  });

  it('uses detail for tasks without reading login message', () => {
    expect(httpErrorMessage({ response: { data: { message: 'Login', detail: 'Tasks' } } }, 'detail', 'Fallback')).toBe('Tasks');
  });
});