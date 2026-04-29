/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { DEFAULT_PERFORMANCE_BUDGETS, assertLighthouseBudget, type LighthouseMetrics } from './regression-gates';

describe('regression-gates', () => {
  describe('DEFAULT_PERFORMANCE_BUDGETS', () => {
    it('defines budgets for all major routes', () => {
      expect(DEFAULT_PERFORMANCE_BUDGETS.homepage).toBeDefined();
      expect(DEFAULT_PERFORMANCE_BUDGETS.pricing).toBeDefined();
      expect(DEFAULT_PERFORMANCE_BUDGETS.dashboard).toBeDefined();
      expect(DEFAULT_PERFORMANCE_BUDGETS.checkout).toBeDefined();
    });

    it('has homepage budget with expected structure', () => {
      const homepage = DEFAULT_PERFORMANCE_BUDGETS.homepage!;
      expect(homepage.performanceScore).toBe(80);
      expect(homepage.fcp).toBe(1500);
      expect(homepage.lcp).toBe(3500);
      expect(homepage.cls).toBe(0.1);
    });

    it('has pricing budget with expected values', () => {
      const pricing = DEFAULT_PERFORMANCE_BUDGETS.pricing!;
      expect(pricing.performanceScore).toBe(80);
      expect(pricing.fcp).toBe(1600);
      expect(pricing.lcp).toBe(3800);
      expect(pricing.cls).toBe(0.15);
    });

    it('has checkout budget with strict performance requirement', () => {
      const checkout = DEFAULT_PERFORMANCE_BUDGETS.checkout!;
      expect(checkout.performanceScore).toBe(85);
      expect(checkout.fcp).toBe(1200);
      expect(checkout.lcp).toBe(3000);
      expect(checkout.cls).toBe(0.05);
    });

    it('has dashboard budget for authenticated routes', () => {
      const dashboard = DEFAULT_PERFORMANCE_BUDGETS.dashboard!;
      expect(dashboard.performanceScore).toBe(75);
      expect(dashboard.fcp).toBe(2000);
      expect(dashboard.lcp).toBe(4500);
      expect(dashboard.cls).toBe(0.2);
    });
  });

  describe('assertLighthouseBudget', () => {
    it('passes when metrics meet budget', () => {
      const metrics: LighthouseMetrics = {
        performance: 85,
        accessibility: 90,
        bestPractices: 85,
        seo: 85,
        fcp: 1400,
        lcp: 3200,
        cls: 0.08,
      };

      const budget = DEFAULT_PERFORMANCE_BUDGETS.homepage!;
      expect(() => assertLighthouseBudget(metrics, budget)).not.toThrow();
    });

    it('throws when performance score is below budget', () => {
      const metrics: LighthouseMetrics = {
        performance: 70,
        accessibility: 90,
        bestPractices: 85,
        seo: 85,
        fcp: 1400,
        lcp: 3200,
        cls: 0.08,
      };

      const budget = DEFAULT_PERFORMANCE_BUDGETS.homepage!;
      expect(() => assertLighthouseBudget(metrics, budget)).toThrow();
    });

    it('throws when FCP exceeds budget', () => {
      const metrics: LighthouseMetrics = {
        performance: 85,
        accessibility: 90,
        bestPractices: 85,
        seo: 85,
        fcp: 2000,
        lcp: 3200,
        cls: 0.08,
      };

      const budget = DEFAULT_PERFORMANCE_BUDGETS.homepage!;
      expect(() => assertLighthouseBudget(metrics, budget)).toThrow();
    });

    it('throws when LCP exceeds budget', () => {
      const metrics: LighthouseMetrics = {
        performance: 85,
        accessibility: 90,
        bestPractices: 85,
        seo: 85,
        fcp: 1400,
        lcp: 4000,
        cls: 0.08,
      };

      const budget = DEFAULT_PERFORMANCE_BUDGETS.homepage!;
      expect(() => assertLighthouseBudget(metrics, budget)).toThrow();
    });

    it('throws when CLS exceeds budget', () => {
      const metrics: LighthouseMetrics = {
        performance: 85,
        accessibility: 90,
        bestPractices: 85,
        seo: 85,
        fcp: 1400,
        lcp: 3200,
        cls: 0.15,
      };

      const budget = DEFAULT_PERFORMANCE_BUDGETS.homepage!;
      expect(() => assertLighthouseBudget(metrics, budget)).toThrow();
    });

    it('passes with exact boundary values (homepage)', () => {
      const metrics: LighthouseMetrics = {
        performance: 80,
        accessibility: 90,
        bestPractices: 85,
        seo: 85,
        fcp: 1500,
        lcp: 3500,
        cls: 0.1,
      };

      const budget = DEFAULT_PERFORMANCE_BUDGETS.homepage!;
      expect(() => assertLighthouseBudget(metrics, budget)).not.toThrow();
    });

    it('passes for checkout with stricter budget', () => {
      const metrics: LighthouseMetrics = {
        performance: 85,
        accessibility: 90,
        bestPractices: 85,
        seo: 85,
        fcp: 1200,
        lcp: 3000,
        cls: 0.05,
      };

      const budget = DEFAULT_PERFORMANCE_BUDGETS.checkout!;
      expect(() => assertLighthouseBudget(metrics, budget)).not.toThrow();
    });

    it('throws for checkout when LCP exceeds strict budget', () => {
      const metrics: LighthouseMetrics = {
        performance: 85,
        accessibility: 90,
        bestPractices: 85,
        seo: 85,
        fcp: 1200,
        lcp: 3100,
        cls: 0.05,
      };

      const budget = DEFAULT_PERFORMANCE_BUDGETS.checkout!;
      expect(() => assertLighthouseBudget(metrics, budget)).toThrow();
    });
  });
});
