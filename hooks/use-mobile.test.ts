import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useIsMobile } from "./use-mobile";

describe("useIsMobile", () => {
  let matchMediaMock: ReturnType<typeof mock>;
  let addEventListenerSpy: ReturnType<typeof mock>;
  let removeEventListenerSpy: ReturnType<typeof mock>;
  let originalInnerWidth: number;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    // Store original values
    originalInnerWidth = window.innerWidth;
    originalMatchMedia = window.matchMedia;

    // Create mock functions for addEventListener and removeEventListener
    addEventListenerSpy = mock(() => {});
    removeEventListenerSpy = mock(() => {});

    // Mock matchMedia
    matchMediaMock = mock((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: mock(() => {}), // Deprecated
      removeListener: mock(() => {}), // Deprecated
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
      dispatchEvent: mock(() => true),
    }));

    window.matchMedia = matchMediaMock as any;
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    window.matchMedia = originalMatchMedia;
  });

  describe("Initial state and mobile detection", () => {
    it("should return false initially (coerced from undefined)", () => {
      // Set desktop width
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => useIsMobile());

      // Initially returns false (!!undefined)
      expect(result.current).toBe(false);
    });

    it("should detect mobile width (< 768px)", () => {
      // Set mobile width
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { result } = renderHook(() => useIsMobile());

      // After effect runs, should be true
      expect(result.current).toBe(true);
    });

    it("should detect desktop width (>= 768px)", () => {
      // Set desktop width
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => useIsMobile());

      // After effect runs, should be false
      expect(result.current).toBe(false);
    });

    it("should return false for exactly 768px (boundary)", () => {
      // Set width to exactly the breakpoint
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 768,
      });

      const { result } = renderHook(() => useIsMobile());

      // 768px should be considered desktop (not mobile)
      expect(result.current).toBe(false);
    });

    it("should return true for 767px (just below breakpoint)", () => {
      // Set width to just below the breakpoint
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 767,
      });

      const { result } = renderHook(() => useIsMobile());

      // 767px should be considered mobile
      expect(result.current).toBe(true);
    });
  });

  describe("matchMedia integration", () => {
    it("should create matchMedia query with correct breakpoint", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      renderHook(() => useIsMobile());

      // Should call matchMedia with the mobile breakpoint (767px max-width)
      expect(matchMediaMock).toHaveBeenCalledWith("(max-width: 767px)");
    });

    it("should add event listener for media query changes", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      renderHook(() => useIsMobile());

      // Should add change event listener
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "change",
        expect.any(Function),
      );
    });
  });

  describe("Window resize handling", () => {
    it("should update when window resizes from desktop to mobile", () => {
      // Start with desktop width
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => useIsMobile());

      // Initially should be desktop
      expect(result.current).toBe(false);

      // Simulate window resize to mobile
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 375,
        });

        // Get the change callback that was registered
        const changeCallback = addEventListenerSpy.mock.calls[0][1];
        changeCallback();
      });

      // Should now be mobile
      expect(result.current).toBe(true);
    });

    it("should update when window resizes from mobile to desktop", () => {
      // Start with mobile width
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { result } = renderHook(() => useIsMobile());

      // Initially should be mobile
      expect(result.current).toBe(true);

      // Simulate window resize to desktop
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 1024,
        });

        // Get the change callback that was registered
        const changeCallback = addEventListenerSpy.mock.calls[0][1];
        changeCallback();
      });

      // Should now be desktop
      expect(result.current).toBe(false);
    });

    it("should handle multiple resize events", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);

      // Resize to mobile
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 375,
        });
        const changeCallback = addEventListenerSpy.mock.calls[0][1];
        changeCallback();
      });

      expect(result.current).toBe(true);

      // Resize back to desktop
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 1024,
        });
        const changeCallback = addEventListenerSpy.mock.calls[0][1];
        changeCallback();
      });

      expect(result.current).toBe(false);

      // Resize to tablet (still desktop)
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 800,
        });
        const changeCallback = addEventListenerSpy.mock.calls[0][1];
        changeCallback();
      });

      expect(result.current).toBe(false);
    });
  });

  describe("Cleanup", () => {
    it("should remove event listener on unmount", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { unmount } = renderHook(() => useIsMobile());

      // Event listener should be added
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

      unmount();

      // Event listener should be removed with the same callback
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "change",
        addEventListenerSpy.mock.calls[0][1],
      );
    });

    it("should not cause errors when unmounted before state update", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { unmount } = renderHook(() => useIsMobile());

      // Unmount immediately
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Common mobile device widths", () => {
    it.each([
      ["iPhone SE", 375],
      ["iPhone 12/13/14", 390],
      ["iPhone 12/13/14 Pro Max", 428],
      ["Samsung Galaxy S20", 360],
      ["Pixel 5", 393],
      ["iPad Mini", 768],
      ["Small phone", 320],
    ])("should correctly detect %s with width %dpx", (_, width) => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: width,
      });

      const { result } = renderHook(() => useIsMobile());

      // Width < 768 should be mobile, >= 768 should be desktop
      expect(result.current).toBe(width < 768);
    });
  });

  describe("Common desktop widths", () => {
    it.each([
      ["Small laptop", 1366],
      ["HD display", 1920],
      ['MacBook Pro 13"', 1440],
      ['MacBook Pro 16"', 1728],
      ["4K display", 3840],
    ])("should correctly detect %s with width %dpx", (_, width) => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: width,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle very small widths (< 320px)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 240,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should handle very large widths (> 4K)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 7680, // 8K display
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it("should return consistent results across multiple hook instances", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { result: result1 } = renderHook(() => useIsMobile());
      const { result: result2 } = renderHook(() => useIsMobile());
      const { result: result3 } = renderHook(() => useIsMobile());

      expect(result1.current).toBe(result2.current);
      expect(result2.current).toBe(result3.current);
      expect(result1.current).toBe(true);
    });
  });
});
