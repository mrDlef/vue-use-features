import {
  expect,
  test,
} from 'vitest';
import useFeatures from "@/useFeatures";

// enable tests
test('It should enable a flag', async () => {
  const {isEnabled, enable} = useFeatures();
  enable('test');
  expect(isEnabled('test')).toBe(true);
});

// disable tests
test('It should disable a flag', async () => {
  const {isEnabled, disable} = useFeatures();
  disable('test');
  expect(isEnabled('test')).toBe(false);
});

// isEnabled tests
test('It should return true when a flag is enabled', async () => {
  const {enable, isEnabled} = useFeatures();
  enable('test');
  expect(isEnabled('test')).toBe(true);
});

test('It should return false when a flag is disabled', async () => {
  const {disable, isEnabled} = useFeatures();
  disable('test');
  expect(isEnabled('test')).toBe(false);
});

// setFlags tests

test('It should set flags', async () => {
  const {isEnabled, all, setFlags} = useFeatures();
  setFlags(['test']);
  expect(isEnabled('test')).toBe(true);
  expect(all()).toEqual(['test']);
});

// unregister tests

test('It should unregister a flag', async () => {
  const {isEnabled, all, unregister} = useFeatures();
  unregister('test');
  expect(isEnabled('test')).toBe(false);
  expect(all()).toEqual([]);
});
