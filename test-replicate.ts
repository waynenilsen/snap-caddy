/**
 * Test script to determine the correct Replicate API version format
 * Run with: bun test-replicate.ts
 */

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

if (!REPLICATE_API_TOKEN) {
  console.error("Error: REPLICATE_API_TOKEN environment variable is not set");
  console.error("Please export it: export REPLICATE_API_TOKEN=r8_your_token");
  process.exit(1);
}

// Test versions to try
const testVersions = ["meta/sam-2", "meta/sam-2:fe97b453", "fe97b453"];

// Small test image (1x1 pixel PNG in base64)
const testImageBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const testImageDataUri = `data:image/png;base64,${testImageBase64}`;

async function testVersion(version: string): Promise<boolean> {
  console.log(`\nTesting version format: "${version}"`);

  const requestBody = {
    version: version,
    input: {
      image: testImageDataUri,
      point_coords: [[100, 100]],
      point_labels: [1],
      multimask_output: false,
    },
  };

  try {
    const response = await fetch(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (response.ok) {
      console.log(`✅ SUCCESS! Version format "${version}" works!`);
      console.log("Response:", JSON.stringify(responseData, null, 2));
      return true;
    } else {
      console.log(`❌ Failed with status ${response.status}`);
      console.log("Response:", JSON.stringify(responseData, null, 2));

      // If it's a 422, it's likely a version format issue
      if (response.status === 422) {
        console.log("   → This appears to be an invalid version format");
      }
      return false;
    }
  } catch (error) {
    console.log(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

async function getModelVersions() {
  console.log("\n=== Attempting to get model versions from API ===");
  try {
    const response = await fetch(
      "https://api.replicate.com/v1/models/meta/sam-2/versions",
      {
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      console.log("Available versions:");
      if (data.results && data.results.length > 0) {
        data.results.forEach((v: any, i: number) => {
          console.log(`  ${i + 1}. ID: ${v.id}`);
          console.log(`     Created: ${v.created_at}`);
          if (v.id === data.results[0].id) {
            console.log(`     ⭐ LATEST VERSION`);
          }
        });
        return data.results[0]?.id;
      }
    } else {
      const errorText = await response.text();
      console.log(`Failed to get versions: ${response.status}`);
      console.log(errorText);
    }
  } catch (error) {
    console.log(
      `Error fetching versions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return null;
}

async function main() {
  console.log("=== Testing Replicate API Version Formats ===\n");
  console.log(`API Token: ${REPLICATE_API_TOKEN.substring(0, 10)}...`);

  // First, try to get the actual version ID from the API
  const latestVersionId = await getModelVersions();

  if (latestVersionId) {
    console.log(`\n📌 Found latest version ID: ${latestVersionId}`);
    // Add the full version ID to test list
    testVersions.push(latestVersionId);
    testVersions.push(`meta/sam-2:${latestVersionId}`);
  }

  // Test each version format
  for (const version of testVersions) {
    const success = await testVersion(version);
    if (success) {
      console.log(`\n🎉 Found working version format: "${version}"`);
      console.log(
        `\nUpdate your configuration to use: SAM_MODEL_VERSION=${version}`,
      );
      break;
    }

    // Wait a bit between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n=== Testing Complete ===");
}

main().catch(console.error);
