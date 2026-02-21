import { sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';

describe('Path Utilities for Cross-Platform Support', () => {
  describe('pathToFileURL conversion', () => {
    it('should convert Unix-style absolute paths to file:// URLs', () => {
      const unixPath = '/home/user/project/loader-hooks.js';
      const url = pathToFileURL(unixPath).href;

      expect(url).toMatch(/^file:\/\//);
      expect(url).toContain('loader-hooks.js');
    });

    it('should convert Windows-style absolute paths to file:// URLs', () => {
      // Simulate a Windows path - pathToFileURL handles this correctly
      const windowsPath = 'C:\\Users\\user\\project\\loader-hooks.js';
      const url = pathToFileURL(windowsPath).href;

      expect(url).toMatch(/^file:\/\//);
      expect(url).toContain('loader-hooks.js');
      // Windows paths should NOT have raw "C:" in the URL
      expect(url).not.toMatch(/^C:/);
    });

    it('should produce URLs that start with file:// protocol', () => {
      const paths = ['/usr/local/bin/node', '/home/user/project/dist/bin/appsync-local.js'];

      for (const p of paths) {
        const url = pathToFileURL(p).href;
        expect(url.startsWith('file://')).toBe(true);
      }
    });

    it('should handle paths with spaces', () => {
      const pathWithSpaces = '/Users/user/My Projects/appsync-local/dist/bin/appsync-local.js';
      const url = pathToFileURL(pathWithSpaces).href;

      expect(url).toMatch(/^file:\/\//);
      // Spaces should be encoded
      expect(url).toContain('My%20Projects');
    });
  });

  describe('isInDist path detection', () => {
    // This tests the logic used in loader-resolve.ts
    function isInDist(dirname: string): boolean {
      return dirname.includes(`${sep}dist${sep}`) || dirname.includes('/dist/');
    }

    it('should detect /dist/ in Unix paths', () => {
      const unixPath = '/home/user/project/dist/src/loader-resolve.js';
      expect(isInDist(unixPath)).toBe(true);
    });

    it('should detect dist with current platform separator', () => {
      // This uses the actual platform separator
      const platformPath = ['', 'home', 'user', 'project', 'dist', 'src', 'loader-resolve.js'].join(sep);
      expect(isInDist(platformPath)).toBe(true);
    });

    it('should return false for paths without dist directory', () => {
      const srcPath = '/home/user/project/src/loader-resolve.ts';
      expect(isInDist(srcPath)).toBe(false);
    });

    it('should not match "dist" as part of another word', () => {
      const distInWordPath = '/home/user/distributed/src/file.js';
      expect(isInDist(distInWordPath)).toBe(false);
    });

    it('should handle Windows-style backslash paths', () => {
      // Simulate Windows path check - the check includes both separators
      function isInDistWindows(dirname: string): boolean {
        return dirname.includes('\\dist\\') || dirname.includes('/dist/');
      }

      const windowsPath = 'C:\\Users\\user\\project\\dist\\src\\loader-resolve.js';
      expect(isInDistWindows(windowsPath)).toBe(true);

      const windowsSrcPath = 'C:\\Users\\user\\project\\src\\loader-resolve.ts';
      expect(isInDistWindows(windowsSrcPath)).toBe(false);
    });
  });

  describe('ESM loader spawn arguments', () => {
    it('should produce valid --import arguments from file:// URLs', () => {
      // The --import flag accepts file:// URLs
      const loaderPath = '/home/user/project/dist/src/loader-hooks.js';
      const loaderUrl = pathToFileURL(loaderPath).href;

      // Should be a valid URL that Node.js ESM loader can use
      expect(loaderUrl).toMatch(/^file:\/\//);
      expect(() => new URL(loaderUrl)).not.toThrow();
    });

    it('should handle the script path as a file:// URL', () => {
      const scriptPath = '/home/user/project/dist/bin/appsync-local.js';
      const scriptUrl = pathToFileURL(scriptPath).href;

      expect(scriptUrl).toMatch(/^file:\/\//);
      expect(() => new URL(scriptUrl)).not.toThrow();
    });
  });
});
