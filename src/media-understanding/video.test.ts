// @ts-nocheck
/**
 * media-understanding/video.test.ts — Video analysis tests
 */
import { describe, it, expect } from 'vitest';
import { calculateFrameSamplePoints, buildCompositeVideoPrompt, buildVideoAnalysisParams } from './video.js';

describe('Video Analysis', () => {
    describe('calculateFrameSamplePoints', () => {
        it('single frame → middle', () => {
            expect(calculateFrameSamplePoints(10, 1)).toEqual([5]);
        });

        it('multiple frames → evenly spaced', () => {
            const points = calculateFrameSamplePoints(100, 4);
            expect(points).toHaveLength(4);
            expect(points[0]).toBeCloseTo(20, 0);
            expect(points[3]).toBeCloseTo(80, 0);
        });

        it('no frames → empty', () => {
            expect(calculateFrameSamplePoints(60, 0)).toEqual([]);
        });
    });

    describe('buildCompositeVideoPrompt', () => {
        it('builds with frames', () => {
            const result = buildCompositeVideoPrompt({
                basePrompt: 'Describe this video',
                frameDescriptions: ['Scene 1', 'Scene 2'],
            });
            expect(result).toContain('Describe this video');
            expect(result).toContain('Frame 1');
            expect(result).toContain('Scene 1');
        });

        it('includes audio transcription', () => {
            const result = buildCompositeVideoPrompt({
                basePrompt: 'Describe',
                frameDescriptions: [],
                audioTranscription: 'Hello world',
            });
            expect(result).toContain('Audio Transcription');
            expect(result).toContain('Hello world');
        });
    });

    describe('buildVideoAnalysisParams', () => {
        it('uses defaults', () => {
            const params = buildVideoAnalysisParams({ type: 'video', source: { kind: 'url', url: 'test' } });
            expect(params.sampleFrames).toBe(5);
            expect(params.includeAudio).toBe(true);
        });
    });
});
