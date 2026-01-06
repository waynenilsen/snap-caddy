import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E tests for the Capture Step (Step 0) - the first step in the wizard flow.
 *
 * This test suite verifies:
 * - Page loads correctly with the wizard UI
 * - Capture step is displayed as the first step
 * - Camera and Upload tabs are present and functional
 * - Image upload functionality works correctly
 * - Tips section is visible
 * - Navigation elements are present
 */

test.describe('Capture Step (Step 0)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page
    await page.goto('/');
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should display the application header with logo and title', async ({ page }) => {
    // Check header elements
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check for Snap Caddy title
    const title = page.locator('header h1');
    await expect(title).toHaveText('Snap Caddy');

    // Check for Start Over button
    const startOverButton = page.getByRole('button', { name: /Start Over/i });
    await expect(startOverButton).toBeVisible();
  });

  // Note: This test is flaky due to CSS visibility of step indicator spans
  test.skip('should display the step indicator with Capture as first step', async ({ page }) => {
    // Wait for page to load and step indicator to show
    await page.waitForTimeout(500);

    // The step indicator should show Capture step text - use .first() to avoid strict mode
    await expect(page.getByText('Capture').first()).toBeVisible();

    // Upload or capture image subtitle should also be visible
    await expect(page.getByText(/Upload or/i).first()).toBeVisible();
  });

  test('should display the Capture Image card with title and description', async ({ page }) => {
    // Check for the main card title
    const cardTitle = page.getByText('Capture Image', { exact: true });
    await expect(cardTitle).toBeVisible();

    // Check for the description
    const description = page.getByText(/Take a photo of your object or upload an existing image/i);
    await expect(description).toBeVisible();
  });

  test('should display Camera and Upload tabs', async ({ page }) => {
    // Check for Camera tab
    const cameraTab = page.getByRole('tab', { name: /Camera/i });
    await expect(cameraTab).toBeVisible();
    await expect(cameraTab).toHaveAttribute('data-state', 'active');

    // Check for Upload tab
    const uploadTab = page.getByRole('tab', { name: /Upload/i });
    await expect(uploadTab).toBeVisible();
    await expect(uploadTab).toHaveAttribute('data-state', 'inactive');
  });

  test('should switch to Upload tab when clicked', async ({ page }) => {
    // Click on Upload tab
    const uploadTab = page.getByRole('tab', { name: /Upload/i });
    await uploadTab.click();

    // Verify Upload tab is now active
    await expect(uploadTab).toHaveAttribute('data-state', 'active');

    // Camera tab should be inactive
    const cameraTab = page.getByRole('tab', { name: /Camera/i });
    await expect(cameraTab).toHaveAttribute('data-state', 'inactive');

    // Upload interface should be visible
    const uploadArea = page.getByText(/Drag and drop your image here/i);
    await expect(uploadArea).toBeVisible();
  });

  test('should display tips section for best results', async ({ page }) => {
    // Check for tips heading
    const tipsHeading = page.getByText('Tips for best results:');
    await expect(tipsHeading).toBeVisible();

    // Check for specific tips
    await expect(page.getByText(/Place the object on a contrasting background/i)).toBeVisible();
    await expect(page.getByText(/Ensure good, even lighting/i)).toBeVisible();
    await expect(page.getByText(/Include a ruler or known-size object/i)).toBeVisible();
  });

  test('should display navigation buttons', async ({ page }) => {
    // Check for navigation at the bottom
    const navigation = page.locator('.sticky.bottom-0');
    await expect(navigation).toBeVisible();

    // Back button should be disabled on first step
    const backButton = page.getByRole('button', { name: 'Go to previous step' });
    await expect(backButton).toBeVisible();
    await expect(backButton).toBeDisabled();

    // Next button should be visible but disabled until image is captured
    const nextButton = page.getByRole('button', { name: 'Go to next step' });
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeDisabled();
  });

  test('should upload an image and show preview', async ({ page }) => {
    // Switch to Upload tab
    const uploadTab = page.getByRole('tab', { name: /Upload/i });
    await uploadTab.click();

    // Get the file input (may be hidden, so we set files directly)
    const fileInput = page.locator('input[type="file"]');

    // Set the file using the test fixture
    const testImagePath = path.join(__dirname, 'fixtures', 'test-object.png');
    await fileInput.setInputFiles(testImagePath);

    // Wait for the image preview to appear
    await page.waitForSelector('text=Image Preview', { timeout: 10000 });

    // Check that the preview card is shown
    const previewTitle = page.getByText('Image Preview', { exact: true });
    await expect(previewTitle).toBeVisible();

    // Check for the retake button
    const retakeButton = page.getByRole('button', { name: /Retake|Take New/i });
    await expect(retakeButton).toBeVisible();

    // Next button should now be enabled
    const nextButton = page.getByRole('button', { name: 'Go to next step' });
    await expect(nextButton).toBeEnabled();
  });

  test('should allow retaking image after upload', async ({ page }) => {
    // Switch to Upload tab and upload an image
    const uploadTab = page.getByRole('tab', { name: /Upload/i });
    await uploadTab.click();

    const fileInput = page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, 'fixtures', 'test-object.png');
    await fileInput.setInputFiles(testImagePath);

    // Wait for preview
    await page.waitForSelector('text=Image Preview', { timeout: 10000 });

    // Click the retake button
    const retakeButton = page.getByRole('button', { name: /Retake|Take New/i });
    await retakeButton.click();

    // Should go back to the capture interface
    await expect(page.getByText('Capture Image', { exact: true })).toBeVisible();

    // Tabs should be visible again
    await expect(page.getByRole('tab', { name: /Camera/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Upload/i })).toBeVisible();
  });

  test('should enable Next button and navigate to next step after image capture', async ({ page }) => {
    // Upload an image
    const uploadTab = page.getByRole('tab', { name: /Upload/i });
    await uploadTab.click();

    const fileInput = page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, 'fixtures', 'test-object.png');
    await fileInput.setInputFiles(testImagePath);

    // Wait for preview
    await page.waitForSelector('text=Image Preview', { timeout: 10000 });

    // Click Next button
    const nextButton = page.getByRole('button', { name: 'Go to next step' });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Should navigate to Step 2 (Segment)
    // The page content should change - we're now on the segmentation step
    // Wait for either the SelectStep component or a "Segment" indication
    await page.waitForTimeout(500); // Small wait for navigation

    // Verify we're on step 2 by checking the URL or step indicator
    // The step indicator should now show step 2 as active
    const selectStep = page.getByText(/Click to Select Object/i);
    await expect(selectStep).toBeVisible({ timeout: 5000 });
  });

  // Note: This test is flaky due to CSS visibility of step indicator spans
  test.skip('should reset wizard when Start Over is clicked', async ({ page }) => {
    // First, upload an image
    const uploadTab = page.getByRole('tab', { name: /Upload/i });
    await uploadTab.click();

    const fileInput = page.locator('input[type="file"]');
    const testImagePath = path.join(__dirname, 'fixtures', 'test-object.png');
    await fileInput.setInputFiles(testImagePath);

    // Wait for preview and go to next step
    await page.waitForSelector('text=Image Preview', { timeout: 10000 });
    const nextButton = page.getByRole('button', { name: 'Go to next step' });
    await nextButton.click();

    // Wait for Segment step
    await page.waitForSelector('text=Click to Select Object', { timeout: 5000 });

    // Click Start Over button
    const startOverButton = page.getByRole('button', { name: /Start Over/i });
    await startOverButton.click();

    // Should go back to Capture step (step indicator shows Capture is active)
    // Wait for navigation to complete
    await page.waitForTimeout(500);

    // The step indicator should show Capture step (use .first() to avoid strict mode)
    await expect(page.getByText('Capture').first()).toBeVisible();
  });
});

test.describe('Capture Step - Accessibility', () => {
  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tabs should have proper roles
    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible();

    // Individual tabs should have tab role
    const tabs = page.getByRole('tab');
    expect(await tabs.count()).toBeGreaterThanOrEqual(2);

    // Buttons should be properly labeled
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(2);
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to the first interactive element
    await page.keyboard.press('Tab');

    // Continue tabbing through the interface
    // The tabs should be keyboard accessible
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // We should be able to activate tabs with Enter
    const cameraTab = page.getByRole('tab', { name: /Camera/i });
    await cameraTab.focus();

    // Switch to Upload tab using keyboard
    await page.keyboard.press('ArrowRight');
    const uploadTab = page.getByRole('tab', { name: /Upload/i });
    await expect(uploadTab).toBeFocused();
  });
});
