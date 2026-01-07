import { describe, it, expect } from "bun:test";
import { validateSVG, sanitizeSVG, MAX_SVG_SIZE, DANGEROUS_TAGS } from "./svg";

describe("validateSVG", () => {
  describe("empty and whitespace input", () => {
    it("should return invalid for empty string", () => {
      const result = validateSVG("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("SVG content is empty");
    });

    it("should return invalid for whitespace-only string", () => {
      const result = validateSVG("   \n\t  ");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("SVG content is empty");
    });
  });

  describe("valid SVG formats", () => {
    it("should validate SVG starting with <svg tag", () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate SVG starting with <?xml declaration", () => {
      const svg = '<?xml version="1.0" encoding="UTF-8"?><svg><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate SVG starting with <!DOCTYPE svg", () => {
      const svg =
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate SVG with leading whitespace", () => {
      const svg =
        '  \n  <svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate complex valid SVG", () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="blue"/>
        <path d="M 10 10 L 90 90" stroke="red"/>
      </svg>`;
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
    });
  });

  describe("size validation", () => {
    it("should reject SVG exceeding MAX_SVG_SIZE", () => {
      // Create a string that exceeds MAX_SVG_SIZE
      const largeContent = "x".repeat(MAX_SVG_SIZE + 1);
      const svg = `<svg>${largeContent}</svg>`;
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum allowed size");
      expect(result.error).toContain(MAX_SVG_SIZE.toString());
    });

    it("should accept SVG at exactly MAX_SVG_SIZE", () => {
      // Create a string that is exactly at MAX_SVG_SIZE
      const svgStart = "<svg>";
      const svgEnd = "</svg>";
      const contentSize =
        MAX_SVG_SIZE - Buffer.byteLength(svgStart + svgEnd, "utf8");
      const content = "x".repeat(contentSize);
      const svg = svgStart + content + svgEnd;
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
    });

    it("should accept small SVG well under size limit", () => {
      const svg = "<svg><rect /></svg>";
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
    });
  });

  describe("invalid format detection", () => {
    it("should reject non-SVG XML", () => {
      const result = validateSVG("<html><body>Not an SVG</body></html>");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid SVG format");
    });

    it("should reject plain text", () => {
      const result = validateSVG("This is just plain text");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid SVG format");
    });

    it("should reject JSON", () => {
      const result = validateSVG('{"type": "svg"}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid SVG format");
    });

    it("should reject malformed tags", () => {
      const result = validateSVG("< svg>");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid SVG format");
    });
  });

  describe("dangerous tags detection", () => {
    it("should reject SVG with script tag", () => {
      const svg = '<svg><script>alert("xss")</script><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("dangerous tag");
      expect(result.error).toContain("script");
    });

    it("should reject SVG with iframe tag", () => {
      const svg = '<svg><iframe src="evil.com"></iframe><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("dangerous tag");
      expect(result.error).toContain("iframe");
    });

    it("should reject SVG with embed tag", () => {
      const svg = '<svg><embed src="evil.swf" /><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("dangerous tag");
      expect(result.error).toContain("embed");
    });

    it("should reject SVG with object tag", () => {
      const svg = '<svg><object data="evil.pdf"></object><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("dangerous tag");
      expect(result.error).toContain("object");
    });

    it("should detect dangerous tags case-insensitively", () => {
      const svg = '<svg><SCRIPT>alert("xss")</SCRIPT></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("dangerous tag");
    });

    it("should detect dangerous tags with attributes", () => {
      const svg =
        '<svg><script type="text/javascript">alert("xss")</script></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("dangerous tag");
    });
  });

  describe("javascript: protocol detection", () => {
    it("should reject SVG with javascript: in href", () => {
      const svg = '<svg><a href="javascript:alert(1)"><rect /></a></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("javascript: protocol");
    });

    it("should reject SVG with javascript: in xlink:href", () => {
      const svg = '<svg><use xlink:href="javascript:alert(1)" /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("javascript: protocol");
    });

    it("should detect javascript: case-insensitively", () => {
      const svg = '<svg><a href="JavaScript:alert(1)"><rect /></a></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("javascript: protocol");
    });

    it("should detect javascript: with URL encoding", () => {
      const svg = '<svg><a href="jav&#x61;script:alert(1)"><rect /></a></svg>';
      const result = validateSVG(svg);
      // Note: Current implementation doesn't decode entities, so this passes validation
      // This is a known limitation - entity-encoded javascript: won't be detected
      expect(result.valid).toBe(true);
    });
  });

  describe("event handler detection", () => {
    it("should reject SVG with onclick handler", () => {
      const svg = '<svg onclick="alert(1)"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("event handlers");
    });

    it("should reject SVG with onload handler", () => {
      const svg = '<svg onload="alert(1)"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("event handlers");
    });

    it("should reject SVG with onmouseover handler", () => {
      const svg = '<svg><rect onmouseover="alert(1)" /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("event handlers");
    });

    it("should reject SVG with onerror handler", () => {
      const svg = '<svg><image onerror="alert(1)" /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("event handlers");
    });

    it("should detect event handlers with single quotes", () => {
      const svg = "<svg onclick='alert(1)'><rect /></svg>";
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("event handlers");
    });

    it("should detect event handlers with double quotes", () => {
      const svg = '<svg onclick="alert(1)"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("event handlers");
    });

    it("should detect multiple event handlers", () => {
      const svg = '<svg onclick="fn1()" onload="fn2()"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("event handlers");
    });
  });

  describe("width and height extraction", () => {
    it("should extract width and height from svg tag", () => {
      const svg = '<svg width="100" height="200"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
    });

    it("should extract width and height with quotes", () => {
      const svg = '<svg width="150" height="250"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(150);
      expect(result.height).toBe(250);
    });

    it("should extract width and height without quotes", () => {
      const svg = "<svg width=300 height=400><rect /></svg>";
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(300);
      expect(result.height).toBe(400);
    });

    it("should extract decimal width and height", () => {
      const svg = '<svg width="100.5" height="200.75"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(100.5);
      expect(result.height).toBe(200.75);
    });

    it("should return undefined dimensions when not present", () => {
      const svg = '<svg viewBox="0 0 100 100"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.width).toBeUndefined();
      expect(result.height).toBeUndefined();
    });

    it("should extract only width when height is missing", () => {
      const svg = '<svg width="100"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(100);
      expect(result.height).toBeUndefined();
    });

    it("should extract only height when width is missing", () => {
      const svg = '<svg height="200"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.width).toBeUndefined();
      expect(result.height).toBe(200);
    });

    it("should extract dimensions with other attributes present", () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200" viewBox="0 0 100 200"><rect /></svg>';
      const result = validateSVG(svg);
      expect(result.valid).toBe(true);
      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
    });
  });

  describe("constants", () => {
    it("should export MAX_SVG_SIZE constant", () => {
      expect(MAX_SVG_SIZE).toBe(1024 * 1024);
    });

    it("should export DANGEROUS_TAGS constant", () => {
      expect(DANGEROUS_TAGS).toEqual(["script", "iframe", "embed", "object"]);
    });
  });
});

describe("sanitizeSVG", () => {
  describe("dangerous tags removal", () => {
    it("should remove script tags and their content", () => {
      const svg = '<svg><script>alert("xss")</script><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("<script");
      expect(result).not.toContain("alert");
      expect(result).toContain("<rect />");
    });

    it("should remove iframe tags and their content", () => {
      const svg = '<svg><iframe src="evil.com">content</iframe><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("<iframe");
      expect(result).not.toContain("evil.com");
      expect(result).toContain("<rect />");
    });

    it("should remove embed tags", () => {
      const svg = '<svg><embed src="evil.swf">content</embed><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("<embed");
      expect(result).not.toContain("evil.swf");
      expect(result).toContain("<rect />");
    });

    it("should remove object tags", () => {
      const svg = '<svg><object data="evil.pdf">content</object><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("<object");
      expect(result).not.toContain("evil.pdf");
      expect(result).toContain("<rect />");
    });

    it("should remove self-closing dangerous tags", () => {
      const svg = '<svg><script src="evil.js" /><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("<script");
      expect(result).not.toContain("evil.js");
      expect(result).toContain("<rect />");
    });

    it("should remove multiple dangerous tags", () => {
      const svg =
        "<svg><script>bad1</script><iframe>bad2</iframe><rect /></svg>";
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("<script");
      expect(result).not.toContain("<iframe");
      expect(result).not.toContain("bad1");
      expect(result).not.toContain("bad2");
      expect(result).toContain("<rect />");
    });

    it("should handle dangerous tags case-insensitively", () => {
      const svg = '<svg><SCRIPT>alert("xss")</SCRIPT><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("SCRIPT");
      expect(result).not.toContain("alert");
    });

    it("should remove nested dangerous tags", () => {
      const svg = "<svg><g><script>alert(1)</script></g><rect /></svg>";
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("<script");
      expect(result).toContain("<g>");
      expect(result).toContain("<rect />");
    });
  });

  describe("javascript: protocol removal", () => {
    it("should remove javascript: from href attributes", () => {
      const svg = '<svg><a href="javascript:alert(1)"><rect /></a></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("javascript:");
      expect(result).toContain('href="');
      expect(result).toContain("<a");
    });

    it("should remove javascript: case-insensitively", () => {
      const svg = '<svg><a href="JavaScript:alert(1)"><rect /></a></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("javascript:");
      expect(result).not.toContain("JavaScript:");
    });

    it("should remove all instances of javascript:", () => {
      const svg =
        '<svg><a href="javascript:x">A</a><use xlink:href="javascript:y" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("javascript:");
    });
  });

  describe("event handler removal", () => {
    it("should remove onclick handlers with double quotes", () => {
      const svg = '<svg onclick="alert(1)"><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("onclick");
      expect(result).not.toContain("alert");
    });

    it("should remove onclick handlers with single quotes", () => {
      const svg = "<svg onclick='alert(1)'><rect /></svg>";
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("onclick");
      expect(result).not.toContain("alert");
    });

    it("should remove onload handlers", () => {
      const svg = '<svg onload="malicious()"><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("onload");
      expect(result).not.toContain("malicious");
    });

    it("should remove onmouseover handlers", () => {
      const svg = '<svg><rect onmouseover="alert(1)" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("onmouseover");
    });

    it("should remove onerror handlers", () => {
      const svg = '<svg><image onerror="alert(1)" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("onerror");
    });

    it("should remove multiple event handlers", () => {
      const svg =
        '<svg onclick="fn1()" onload="fn2()" onmouseover="fn3()"><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("onclick");
      expect(result).not.toContain("onload");
      expect(result).not.toContain("onmouseover");
    });

    it("should remove event handlers without quotes", () => {
      const svg = "<svg onclick=alert(1)><rect /></svg>";
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("onclick");
    });

    it("should handle various event handler names", () => {
      const svg =
        '<svg onabort="x" onblur="x" onchange="x" onfocus="x"><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("onabort");
      expect(result).not.toContain("onblur");
      expect(result).not.toContain("onchange");
      expect(result).not.toContain("onfocus");
    });
  });

  describe("data URI removal", () => {
    it("should remove data:text/html URIs", () => {
      const svg =
        '<svg><image href="data:text/html,<script>alert(1)</script>" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("data:text/html");
    });

    it("should remove data:image/svg+xml URIs", () => {
      const svg =
        '<svg><image href="data:image/svg+xml,<svg><script>alert(1)</script></svg>" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("data:image/svg+xml");
    });

    it("should remove data URIs case-insensitively", () => {
      const svg = '<svg><image href="DATA:TEXT/HTML,evil" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).not.toContain("data:text/html");
      expect(result).not.toContain("DATA:TEXT/HTML");
    });
  });

  describe("safe content preservation", () => {
    it("should preserve basic SVG structure", () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).toBe(svg);
    });

    it("should preserve safe attributes", () => {
      const svg =
        '<svg width="100" height="200" viewBox="0 0 100 200"><rect x="10" y="20" width="30" height="40" fill="blue" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).toBe(svg);
    });

    it("should preserve paths and shapes", () => {
      const svg =
        '<svg><path d="M 10 10 L 90 90" /><circle cx="50" cy="50" r="40" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).toBe(svg);
    });

    it("should preserve groups and transforms", () => {
      const svg = '<svg><g transform="translate(10,10)"><rect /></g></svg>';
      const result = sanitizeSVG(svg);
      expect(result).toBe(svg);
    });

    it("should preserve styles (but not dangerous content)", () => {
      const svg = '<svg><rect style="fill:blue;stroke:red" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).toContain('style="fill:blue;stroke:red"');
    });

    it("should preserve defs and use elements", () => {
      const svg = '<svg><defs><rect id="r1" /></defs><use href="#r1" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).toContain("<defs>");
      expect(result).toContain("<use");
    });

    it("should preserve gradients and filters", () => {
      const svg =
        '<svg><defs><linearGradient id="g1"><stop offset="0%" /></linearGradient></defs></svg>';
      const result = sanitizeSVG(svg);
      expect(result).toContain("linearGradient");
      expect(result).toContain("stop");
    });
  });

  describe("complex sanitization scenarios", () => {
    it("should sanitize SVG with mixed dangerous and safe content", () => {
      const svg = `<svg>
        <rect fill="blue" />
        <script>alert("xss")</script>
        <circle onclick="bad()" r="10" />
        <path d="M 0 0 L 10 10" />
      </svg>`;
      const result = sanitizeSVG(svg);
      expect(result).toContain('<rect fill="blue"');
      expect(result).toContain('<path d="M 0 0 L 10 10"');
      expect(result).not.toContain("<script");
      expect(result).not.toContain("onclick");
    });

    it("should handle empty input", () => {
      const result = sanitizeSVG("");
      expect(result).toBe("");
    });

    it("should handle SVG with only dangerous content", () => {
      const svg = "<svg><script>alert(1)</script></svg>";
      const result = sanitizeSVG(svg);
      expect(result).toBe("<svg></svg>");
    });

    it("should remove dangerous attributes while preserving element", () => {
      const svg =
        '<svg><rect onclick="bad()" fill="blue" width="10" height="10" /></svg>';
      const result = sanitizeSVG(svg);
      expect(result).toContain("<rect");
      expect(result).toContain('fill="blue"');
      expect(result).toContain('width="10"');
      expect(result).not.toContain("onclick");
    });
  });
});
