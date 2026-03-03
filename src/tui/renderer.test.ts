import { describe, expect, it } from 'vitest';
import { colors, box, symbols, TerminalRenderer } from './renderer.js';

describe('renderer — ANSI terminal constants', () => {
  it('colors object has reset key', () => {
    expect(typeof colors.reset).toBe('string');
    expect(colors.reset.length).toBeGreaterThan(0);
  });

  it('colors.bold is a non-empty ANSI string', () => {
    expect(colors.bold).toContain('\x1b[');
  });

  it('colors object has standard color keys', () => {
    const keys = ['reset', 'bold', 'dim'] as const;
    for (const k of keys) {
      expect(colors[k]).toBeDefined();
    }
  });

  it('box object is defined', () => {
    expect(box).toBeDefined();
    expect(typeof box).toBe('object');
  });

  it('symbols object is defined', () => {
    expect(symbols).toBeDefined();
    expect(typeof symbols).toBe('object');
  });

  it('TerminalRenderer is a constructor', () => {
    expect(typeof TerminalRenderer).toBe('function');
  });

  it('TerminalRenderer can be instantiated', () => {
    const renderer = new TerminalRenderer();
    expect(renderer).toBeInstanceOf(TerminalRenderer);
  });
});
