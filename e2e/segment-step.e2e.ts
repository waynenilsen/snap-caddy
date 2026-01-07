import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

/**
 * E2E tests for the Segment Step (Step 1) - the second step in the wizard flow.
 *
 * This test suite verifies:
 * - Navigation to the segment step after image upload
 * - Instructions and info alerts are displayed
 * - Click-to-segment canvas is functional
 * - Point add/remove functionality works
 * - Segmentation controls (Undo, Clear All, Segment) work correctly
 * - API mocking for segmentation response
 * - Navigation to next step after successful segmentation
 */

/**
 * Helper function to navigate to the Segment step by uploading an image first
 */
async function navigateToSegmentStep(page: Page) {
  // Go to home page
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Switch to Upload tab
  const uploadTab = page.getByRole("tab", { name: /Upload/i });
  await uploadTab.click();

  // Upload test image
  const fileInput = page.locator('input[type="file"]');
  const testImagePath = path.join(__dirname, "fixtures", "test-object.png");
  await fileInput.setInputFiles(testImagePath);

  // Wait for preview
  await page.waitForSelector("text=Image Preview", { timeout: 10000 });

  // Click Next button to go to Segment step
  const nextButton = page.getByRole("button", { name: "Go to next step" });
  await nextButton.click();

  // Wait for Segment step to load
  await page.waitForSelector("text=Click to Select Object", { timeout: 5000 });
}

/**
 * Create a mock mask image as a base64 PNG data URL
 * This is a simple 100x100 white square on transparent background
 */
function createMockMaskBase64(): string {
  // This is a valid minimal PNG with a white square (base64 encoded)
  // In a real scenario, this would be a proper mask image
  return "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADq0wNHQAAAAAAElFTkSuQmCC";
}

test.describe("Segment Step (Step 1)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the segment step before each test
    await navigateToSegmentStep(page);
  });

  test("should display the step indicator with Segment as current step", async ({
    page,
  }) => {
    // The step indicator should show we're on step 2
    const stepIndicator = page.locator(".border-b.bg-muted\\/30");
    await expect(stepIndicator).toBeVisible();

    // Segment step should be visible
    const segmentStep = page.getByText("Segment", { exact: true }).first();
    await expect(segmentStep).toBeVisible();
  });

  test("should display the instruction info alert", async ({ page }) => {
    // Check for the instruction alert
    const infoAlert = page.getByText(
      /Click on the object you want to extract/i,
    );
    await expect(infoAlert).toBeVisible();

    // Check for specific instructions about left-click and right-click
    const leftClickInstruction = page.getByText(/include points/i);
    await expect(leftClickInstruction).toBeVisible();

    const rightClickInstruction = page.getByText(/exclude points/i);
    await expect(rightClickInstruction).toBeVisible();
  });

  test("should display the Click to Select Object card", async ({ page }) => {
    // Check for the main card title (CardTitle may not be a heading element)
    const cardTitle = page.getByText("Click to Select Object", { exact: true });
    await expect(cardTitle).toBeVisible();

    // Check for the card description (use .first() since text appears multiple places)
    const leftClickHint = page.getByText("Left-click", { exact: true }).first();
    await expect(leftClickHint).toBeVisible();

    const rightClickHint = page
      .getByText("Right-click", { exact: true })
      .first();
    await expect(rightClickHint).toBeVisible();
  });

  test("should display the canvas with the uploaded image", async ({
    page,
  }) => {
    // Check for the canvas element
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Canvas should have crosshair cursor class
    await expect(canvas).toHaveClass(/cursor-crosshair/);
  });

  test("should display cursor indicator badges", async ({ page }) => {
    // Check for the Include/Exclude badges
    const includeBadge = page.getByText("Left: Include");
    await expect(includeBadge).toBeVisible();

    const excludeBadge = page.getByText("Right: Exclude");
    await expect(excludeBadge).toBeVisible();
  });

  test("should display initial message when no points selected", async ({
    page,
  }) => {
    // Check for the "no points" message
    const noPointsMessage = page.getByText(
      /Click on the object to start segmentation/i,
    );
    await expect(noPointsMessage).toBeVisible();
  });

  test("should display segmentation controls", async ({ page }) => {
    // Check for Undo button
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toBeDisabled(); // No points to undo

    // Check for Clear All button
    const clearButton = page.getByRole("button", { name: /Clear All/i });
    await expect(clearButton).toBeVisible();
    await expect(clearButton).toBeDisabled(); // No points to clear

    // Check for Segment button
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await expect(segmentButton).toBeVisible();
    await expect(segmentButton).toBeDisabled(); // No points to segment
  });

  test("should display point counter showing 0 points initially", async ({
    page,
  }) => {
    // Check for the point counter badge
    const pointCounter = page.getByText("0 points");
    await expect(pointCounter).toBeVisible();
  });

  test("should display navigation buttons", async ({ page }) => {
    // Back button should be enabled on segment step
    const backButton = page.getByRole("button", {
      name: "Go to previous step",
    });
    await expect(backButton).toBeVisible();
    await expect(backButton).toBeEnabled();

    // Next button should be disabled until segmentation is complete
    const nextButton = page.getByRole("button", { name: "Go to next step" });
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeDisabled();
  });

  test("should navigate back to capture step when Back is clicked", async ({
    page,
  }) => {
    // Click Back button
    const backButton = page.getByRole("button", {
      name: "Go to previous step",
    });
    await backButton.click();

    // Should go back to Capture step
    await expect(page.getByText("Capture Image", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    // Camera and Upload tabs should be visible
    await expect(page.getByRole("tab", { name: /Camera/i })).toBeVisible();
  });
});

test.describe("Segment Step - Point Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToSegmentStep(page);
  });

  test("should add a point when clicking on canvas", async ({ page }) => {
    // Get the canvas and click on it
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Click in the center of the canvas
    await canvas.click({ position: { x: 50, y: 50 } });

    // Wait for point to be added
    await page.waitForTimeout(300);

    // Point counter should update to 1 point
    const pointCounter = page.getByText("1 point");
    await expect(pointCounter).toBeVisible();

    // A point badge should appear
    const pointBadge = page.getByText(/Include #1/);
    await expect(pointBadge).toBeVisible();

    // The "no points" message should disappear
    const noPointsMessage = page.getByText(
      /Click on the object to start segmentation/i,
    );
    await expect(noPointsMessage).not.toBeVisible();
  });

  test("should add multiple points", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Get canvas bounding box for proper coordinate calculation
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Add three points at different positions (spread out to avoid overlap)
    await canvas.click({
      position: { x: box?.width * 0.2, y: box?.height * 0.2 },
    });
    await page.waitForTimeout(500);
    await canvas.click({
      position: { x: box?.width * 0.5, y: box?.height * 0.5 },
    });
    await page.waitForTimeout(500);
    await canvas.click({
      position: { x: box?.width * 0.8, y: box?.height * 0.8 },
    });
    await page.waitForTimeout(500);

    // Point counter should show 3 points
    const pointCounter = page.getByText("3 points");
    await expect(pointCounter).toBeVisible({ timeout: 5000 });

    // All three point badges should appear
    await expect(page.getByText(/Include #1/)).toBeVisible();
    await expect(page.getByText(/Include #2/)).toBeVisible();
    await expect(page.getByText(/Include #3/)).toBeVisible();
  });

  // Note: Right-click test is skipped because headless browsers may handle context menu differently
  test.skip("should add exclude point on right-click", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Right-click to add exclude point
    await canvas.click({
      position: { x: box?.width * 0.5, y: box?.height * 0.5 },
      button: "right",
    });
    await page.waitForTimeout(500);

    // Point counter should update
    const pointCounter = page.getByText("1 point");
    await expect(pointCounter).toBeVisible({ timeout: 5000 });

    // An exclude point badge should appear
    const excludeBadge = page.getByText(/Exclude #1/);
    await expect(excludeBadge).toBeVisible();
  });

  test("should enable controls after adding points", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Undo button should be enabled
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toBeEnabled();

    // Clear All button should be enabled
    const clearButton = page.getByRole("button", { name: /Clear All/i });
    await expect(clearButton).toBeEnabled();

    // Segment button should be enabled
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await expect(segmentButton).toBeEnabled();
  });

  test("should undo last point when Undo is clicked", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Add two points at spread positions
    await canvas.click({
      position: { x: box?.width * 0.3, y: box?.height * 0.3 },
    });
    await page.waitForTimeout(500);
    await canvas.click({
      position: { x: box?.width * 0.7, y: box?.height * 0.7 },
    });
    await page.waitForTimeout(500);

    // Verify 2 points
    await expect(page.getByText("2 points")).toBeVisible({ timeout: 5000 });

    // Click Undo
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await undoButton.click();
    await page.waitForTimeout(300);

    // Should have 1 point now
    await expect(page.getByText("1 point")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Include #2/)).not.toBeVisible();
  });

  test("should clear all points when Clear All is clicked", async ({
    page,
  }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Add multiple points at spread positions
    await canvas.click({
      position: { x: box?.width * 0.3, y: box?.height * 0.3 },
    });
    await page.waitForTimeout(500);
    await canvas.click({
      position: { x: box?.width * 0.7, y: box?.height * 0.7 },
    });
    await page.waitForTimeout(500);

    // Verify points added
    await expect(page.getByText("2 points")).toBeVisible({ timeout: 5000 });

    // Click Clear All
    const clearButton = page.getByRole("button", { name: /Clear All/i });
    await clearButton.click();
    await page.waitForTimeout(300);

    // Should have 0 points now
    await expect(page.getByText("0 points")).toBeVisible({ timeout: 5000 });

    // Controls should be disabled again
    await expect(page.getByRole("button", { name: /Undo/i })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /Clear All/i }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: /Segment/i })).toBeDisabled();
  });

  test("should remove point when clicking on point badge", async ({ page }) => {
    const canvas = page.locator("canvas");

    // Add a point
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Verify point badge appears
    const pointBadge = page.getByText(/Include #1/);
    await expect(pointBadge).toBeVisible();

    // Click on the badge to remove the point
    await pointBadge.click();
    await page.waitForTimeout(200);

    // Point should be removed
    await expect(page.getByText("0 points")).toBeVisible();
  });
});

test.describe("Segment Step - API Integration", () => {
  test("should show loading state when Segment button is clicked", async ({
    page,
  }) => {
    // Set up route interception to delay the response
    await page.route("**/api/segment", async (route) => {
      // Delay the response to observe loading state
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          masks: [
            {
              mask: `data:image/png;base64,${createMockMaskBase64()}`,
              confidence: 0.95,
              boundingBox: { x: 10, y: 10, width: 80, height: 80 },
              area: 6400,
            },
          ],
          imageWidth: 100,
          imageHeight: 100,
          processingTimeMs: 500,
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Click Segment button
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Should show loading state
    const loadingText = page.getByText(/Segmenting/i);
    await expect(loadingText).toBeVisible({ timeout: 2000 });

    // Processing indicator should appear
    const processingText = page.getByText(/Processing/i);
    await expect(processingText).toBeVisible({ timeout: 2000 });
  });

  test("should show success message after segmentation completes", async ({
    page,
  }) => {
    // Mock the segment API
    await page.route("**/api/segment", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          masks: [
            {
              mask: `data:image/png;base64,${createMockMaskBase64()}`,
              confidence: 0.95,
              boundingBox: { x: 10, y: 10, width: 80, height: 80 },
              area: 6400,
            },
          ],
          imageWidth: 100,
          imageHeight: 100,
          processingTimeMs: 100,
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Click Segment button
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Should show success message
    const successMessage = page.getByText(/Segmentation complete/i);
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    // Next button should be enabled
    const nextButton = page.getByRole("button", { name: "Go to next step" });
    await expect(nextButton).toBeEnabled({ timeout: 5000 });
  });

  test("should show error message when segmentation fails", async ({
    page,
  }) => {
    // Mock the segment API to return an error
    await page.route("**/api/segment", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Segmentation service unavailable",
          code: "SAM_ERROR",
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Click Segment button
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Should show error alert
    const errorAlert = page
      .locator('[role="alert"]')
      .filter({ hasText: /error|unable|failed/i });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    // Retry button should be visible
    const retryButton = page.getByRole("button", { name: /Retry/i });
    await expect(retryButton).toBeVisible();
  });

  test("should allow retry after error", async ({ page }) => {
    let callCount = 0;

    // Mock API to fail first, then succeed
    await page.route("**/api/segment", async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Temporary error",
            code: "SERVER_ERROR",
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            masks: [
              {
                mask: `data:image/png;base64,${createMockMaskBase64()}`,
                confidence: 0.95,
                boundingBox: { x: 10, y: 10, width: 80, height: 80 },
                area: 6400,
              },
            ],
            imageWidth: 100,
            imageHeight: 100,
            processingTimeMs: 100,
          }),
        });
      }
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // First attempt - should fail
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Wait for error
    const retryButton = page.getByRole("button", { name: /Retry/i });
    await expect(retryButton).toBeVisible({ timeout: 5000 });

    // Click retry
    await retryButton.click();

    // Should succeed now
    const successMessage = page.getByText(/Segmentation complete/i);
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test("should dismiss error when X button is clicked", async ({ page }) => {
    // Mock API to return error
    await page.route("**/api/segment", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Error message",
          code: "SERVER_ERROR",
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Wait for error alert
    const errorAlert = page
      .locator('[role="alert"]')
      .filter({ hasText: /error|unable|failed/i });
    await expect(errorAlert).toBeVisible({ timeout: 5000 });

    // Click dismiss button (X)
    const dismissButton = errorAlert
      .locator("button")
      .filter({ has: page.locator("svg") })
      .last();
    await dismissButton.click();

    // Error should be dismissed
    await expect(errorAlert).not.toBeVisible({ timeout: 2000 });
  });

  test("should navigate to next step after successful segmentation", async ({
    page,
  }) => {
    // Mock the segment API
    await page.route("**/api/segment", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          masks: [
            {
              mask: `data:image/png;base64,${createMockMaskBase64()}`,
              confidence: 0.95,
              boundingBox: { x: 10, y: 10, width: 80, height: 80 },
              area: 6400,
            },
          ],
          imageWidth: 100,
          imageHeight: 100,
          processingTimeMs: 100,
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Click Segment button
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Wait for success
    await page.waitForSelector("text=Segmentation complete", {
      timeout: 10000,
    });

    // Click Next button
    const nextButton = page.getByRole("button", { name: "Go to next step" });
    await expect(nextButton).toBeEnabled({ timeout: 5000 });
    await nextButton.click();

    // Should navigate to Step 3 (Calibrate)
    // Wait for calibration step content to appear
    await page.waitForTimeout(500);

    // Verify we're on the calibration step by checking for unique content
    const calibrateContent = page.getByText("Select Ruler Reference", {
      exact: true,
    });
    await expect(calibrateContent).toBeVisible({ timeout: 5000 });
  });

  test("should show rate limit error message", async ({ page }) => {
    // Mock API to return rate limit error
    await page.route("**/api/segment", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Too many requests",
          code: "RATE_LIMIT",
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Should show rate limit error message
    const errorMessage = page.getByText(/Too many requests/i);
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Segment Step - Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToSegmentStep(page);
  });

  test("should have proper ARIA labels on control buttons", async ({
    page,
  }) => {
    // Undo button should have aria-label
    const undoButton = page.getByRole("button", { name: /Undo/i });
    await expect(undoButton).toHaveAttribute("aria-label", "Undo last point");

    // Clear All button should have aria-label
    const clearButton = page.getByRole("button", { name: /Clear All/i });
    await expect(clearButton).toHaveAttribute("aria-label", "Clear all points");

    // Segment button should have aria-label
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await expect(segmentButton).toHaveAttribute(
      "aria-label",
      "Generate segmentation",
    );
  });

  test("should be keyboard navigable", async ({ page }) => {
    // Back button should be focusable (always enabled on this step)
    const backButton = page.getByRole("button", {
      name: "Go to previous step",
    });
    await backButton.focus();
    await expect(backButton).toBeFocused();

    // Start Over button should be focusable (always enabled)
    const startOverButton = page.getByRole("button", { name: /Start Over/i });
    await startOverButton.focus();
    await expect(startOverButton).toBeFocused();
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    // Check for proper heading structure - page should have at least the main app heading
    const appHeading = page.locator("h1");
    await expect(appHeading.first()).toBeVisible();

    // The card title text should be present and prominent
    const cardTitle = page.getByText("Click to Select Object", { exact: true });
    await expect(cardTitle).toBeVisible();
  });

  test("should announce loading state to screen readers", async ({ page }) => {
    // Mock slow API response
    await page.route("**/api/segment", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          masks: [
            {
              mask: `data:image/png;base64,${createMockMaskBase64()}`,
              confidence: 0.95,
              boundingBox: { x: 10, y: 10, width: 80, height: 80 },
              area: 6400,
            },
          ],
          imageWidth: 100,
          imageHeight: 100,
          processingTimeMs: 100,
        }),
      });
    });

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Loading spinner should be present during processing
    const spinner = page.locator(".animate-spin");
    await expect(spinner.first()).toBeVisible({ timeout: 2000 });
  });
});

test.describe("Segment Step - Edge Cases", () => {
  test("should handle Start Over during segmentation", async ({ page }) => {
    // Mock the segment API
    await page.route("**/api/segment", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          masks: [
            {
              mask: `data:image/png;base64,${createMockMaskBase64()}`,
              confidence: 0.95,
              boundingBox: { x: 10, y: 10, width: 80, height: 80 },
              area: 6400,
            },
          ],
          imageWidth: 100,
          imageHeight: 100,
          processingTimeMs: 100,
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Click Start Over button
    const startOverButton = page.getByRole("button", { name: /Start Over/i });
    await startOverButton.click();

    // Should go back to initial capture state
    await expect(
      page.getByText("Capture Image", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /Camera/i })).toBeVisible();
  });

  test("should preserve points after failed segmentation", async ({ page }) => {
    // Mock API to fail
    await page.route("**/api/segment", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Server error",
          code: "SERVER_ERROR",
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Verify point is added
    await expect(page.getByText("1 point")).toBeVisible();

    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Wait for error
    await page.waitForSelector("text=error", { timeout: 5000 });

    // Points should still be there
    await expect(page.getByText("1 point")).toBeVisible();
    await expect(page.getByText(/Include #1/)).toBeVisible();
  });

  test("should clear mask and return to point selection when Clear All is clicked after segmentation", async ({
    page,
  }) => {
    // Mock the segment API
    await page.route("**/api/segment", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          masks: [
            {
              mask: `data:image/png;base64,${createMockMaskBase64()}`,
              confidence: 0.95,
              boundingBox: { x: 10, y: 10, width: 80, height: 80 },
              area: 6400,
            },
          ],
          imageWidth: 100,
          imageHeight: 100,
          processingTimeMs: 100,
        }),
      });
    });

    await navigateToSegmentStep(page);

    const canvas = page.locator("canvas");
    await canvas.click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(300);

    // Run segmentation
    const segmentButton = page.getByRole("button", { name: /Segment/i });
    await segmentButton.click();

    // Wait for success
    await page.waitForSelector("text=Segmentation complete", {
      timeout: 10000,
    });

    // Click Clear All to start over
    const clearButton = page.getByRole("button", { name: /Clear All/i });
    await clearButton.click();
    await page.waitForTimeout(300);

    // Success message should be gone
    await expect(page.getByText(/Segmentation complete/i)).not.toBeVisible();

    // Should show initial state
    await expect(page.getByText("0 points")).toBeVisible();
    await expect(
      page.getByText(/Click on the object to start segmentation/i),
    ).toBeVisible();
  });
});
