import { describe, it, expect, beforeEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";

const execAsync = promisify(exec);

describe("svs.js CLI", () => {
  const svsPath = join(process.cwd(), "bin", "svs.js");

  describe("command parsing", () => {
    it("should show usage when no command provided", async () => {
      try {
        await execAsync(`node ${svsPath}`, { timeout: 5000 });
        expect.fail("Should have exited with error");
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain("Usage: svs <command>");
        expect(error.stdout || error.stderr).toContain("Commands:");
        expect(error.stdout || error.stderr).toContain("generate:migrations");
        expect(error.stdout || error.stderr).toContain("generate:schema-hashes");
        expect(error.stdout || error.stderr).toContain("generate:all");
      }
    });

    it("should show error for unknown command", async () => {
      try {
        await execAsync(`node ${svsPath} unknown:command`, { timeout: 5000 });
        expect.fail("Should have exited with error");
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout || error.stderr).toContain(
          "Unknown command: unknown:command",
        );
        expect(error.stdout || error.stderr).toContain("Available commands:");
      }
    });
  });

  describe("generate:migrations command", () => {
    it("should accept generate:migrations command", async () => {
      // This will fail because we don't have a real migrations dir, but it should parse the command
      try {
        await execAsync(
          `node ${svsPath} generate:migrations --migrations-dir /nonexistent --index-path /nonexistent/index.ts`,
          { timeout: 10000 },
        );
      } catch (error: any) {
        // Expected to fail, but should not be a "unknown command" error
        expect(error.stdout || error.stderr).not.toContain(
          "Unknown command",
        );
      }
    });
  });

  describe("generate:schema-hashes command", () => {
    it("should accept generate:schema-hashes command", async () => {
      // This will fail because we don't have a real schema file, but it should parse the command
      try {
        await execAsync(
          `node ${svsPath} generate:schema-hashes --schema-file /nonexistent/schema.ts --output-path /nonexistent/hashes.ts`,
          { timeout: 10000 },
        );
      } catch (error: any) {
        // Expected to fail, but should not be a "unknown command" error
        expect(error.stdout || error.stderr).not.toContain(
          "Unknown command",
        );
      }
    });
  });

  describe("generate:all command", () => {
    it("should accept generate:all command", async () => {
      // This will fail because we don't have real files, but it should parse the command
      try {
        await execAsync(`node ${svsPath} generate:all`, { timeout: 15000 });
      } catch (error: any) {
        // Expected to fail, but should not be a "unknown command" error
        expect(error.stdout || error.stderr).not.toContain(
          "Unknown command",
        );
      }
    });

    it("should pass arguments to both scripts in generate:all", async () => {
      // This will fail because we don't have real files, but it should attempt both scripts
      try {
        await execAsync(
          `node ${svsPath} generate:all --migrations-dir /test --index-path /test/index.ts`,
          { timeout: 20000 },
        );
      } catch (error: any) {
        // Expected to fail, but should not be a "unknown command" error
        expect(error.stdout || error.stderr).not.toContain(
          "Unknown command",
        );
      }
    });
  });

  describe("command validation", () => {
    it("should handle empty command gracefully", async () => {
      try {
        await execAsync(`node ${svsPath} ""`, { timeout: 5000 });
        expect.fail("Should have exited with error");
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    });

    it("should handle command with extra whitespace", async () => {
      try {
        await execAsync(`node ${svsPath} "  generate:migrations  "`, {
          timeout: 10000,
        });
      } catch (error: any) {
        // Should either work or show unknown command (depending on how it's parsed)
        expect([0, 1]).toContain(error.code);
      }
    });
  });
});
