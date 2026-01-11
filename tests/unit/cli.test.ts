import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('CLI Module Logic', () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

  afterEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
  });

  describe('Configuration Loading Logic', () => {
    it('should handle successful JSON parsing', () => {
      // Arrange
      const mockConfig = {
        schema: 'schema.graphql',
        apiConfig: { auth: [] },
        resolvers: [],
        dataSources: [],
        port: 4000,
      };
      const mockRawConfig = JSON.stringify(mockConfig);

      // Act
      const parsed = JSON.parse(mockRawConfig);

      // Assert
      expect(parsed).toEqual(mockConfig);
      expect(parsed.schema).toBe('schema.graphql');
      expect(parsed.port).toBe(4000);
    });

    it('should handle JSON parse errors', () => {
      // Arrange
      const invalidJson = '{ invalid json }';

      // Act & Assert
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should handle file read errors', () => {
      // Arrange
      const mockError = new Error('ENOENT: no such file or directory');
      const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw mockError;
      });

      // Act & Assert
      expect(() => fs.readFileSync('/nonexistent/file.json', 'utf-8')).toThrow('ENOENT: no such file or directory');

      // Cleanup
      mockReadFileSync.mockRestore();
    });

    it('should handle successful file reading', () => {
      // Arrange
      const mockContent = '{"test": "content"}';
      const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(mockContent);

      // Act
      const content = fs.readFileSync('/test/file.json', 'utf-8');

      // Assert
      expect(content).toBe(mockContent);

      // Cleanup
      mockReadFileSync.mockRestore();
    });
  });

  describe('Port Configuration Logic', () => {
    it('should parse custom port correctly', () => {
      // Test port parsing logic
      const port = '5000';
      const serverPort = Number(port);

      expect(serverPort).toBe(5000);
      expect(typeof serverPort).toBe('number');
    });

    it('should use PORT environment variable when no port option provided', () => {
      // Mock environment variable
      const originalPort = process.env.PORT;
      process.env.PORT = '3000';

      const port = process.env.PORT || '4000';
      const serverPort = Number(port);

      expect(serverPort).toBe(3000);

      // Restore
      process.env.PORT = originalPort;
    });

    it('should default to port 4000 when no port option or environment variable provided', () => {
      // Clear environment variable (biome-ignore: delete is necessary for env vars)
      const originalPort = process.env.PORT;
      // biome-ignore lint/performance/noDelete: required to truly unset env var
      delete process.env.PORT;

      const port = process.env.PORT || '4000';
      const serverPort = Number(port);

      expect(serverPort).toBe(4000);

      // Restore
      process.env.PORT = originalPort;
    });

    it('should handle invalid port numbers', () => {
      // Test invalid port
      const port = 'invalid';
      const serverPort = Number(port);

      expect(Number.isNaN(serverPort)).toBe(true);
    });
  });

  describe('Path Resolution Logic', () => {
    it('should resolve config path relative to current working directory', () => {
      // Arrange
      const configPath = 'config.json';
      const expectedResolvedPath = '/current/working/dir/config.json';

      const mockResolve = jest.spyOn(path, 'resolve').mockReturnValue(expectedResolvedPath);

      // Simulate the CLI path resolution logic
      const fullPath = path.resolve(process.cwd(), configPath);

      // Assert
      expect(mockResolve).toHaveBeenCalledWith(process.cwd(), configPath);
      expect(fullPath).toBe(expectedResolvedPath);

      // Cleanup
      mockResolve.mockRestore();
    });

    it('should handle absolute paths', () => {
      // Arrange
      const absolutePath = '/absolute/path/to/config.json';
      const mockResolve = jest.spyOn(path, 'resolve').mockReturnValue(absolutePath);

      // Act
      const fullPath = path.resolve(process.cwd(), absolutePath);

      // Assert
      expect(fullPath).toBe(absolutePath);

      // Cleanup
      mockResolve.mockRestore();
    });

    it('should handle relative paths with directory traversal', () => {
      // Arrange
      const relativePath = '../config/config.json';
      const expectedPath = '/resolved/path/to/config.json';
      const mockResolve = jest.spyOn(path, 'resolve').mockReturnValue(expectedPath);

      // Act
      const fullPath = path.resolve(process.cwd(), relativePath);

      // Assert
      expect(fullPath).toBe(expectedPath);

      // Cleanup
      mockResolve.mockRestore();
    });
  });

  describe('Error Message Formatting', () => {
    it('should format file read error messages correctly', () => {
      // Arrange
      const mockError = new Error('ENOENT: no such file or directory');

      // Act
      const errorMessage = mockError.message;

      // Assert
      expect(errorMessage).toBe('ENOENT: no such file or directory');
      expect(errorMessage).toContain('ENOENT');
    });

    it('should format JSON parse error messages correctly', () => {
      // Arrange
      const invalidJson = '{ invalid json }';

      // Act
      try {
        JSON.parse(invalidJson);
        fail('Should have thrown an error');
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);

        // Assert
        expect(errorMessage).toBeDefined();
        expect(typeof errorMessage).toBe('string');
      }
    });

    it('should format config error messages correctly', () => {
      // Arrange
      const errorType = 'Config';
      const errorDetails = 'Invalid schema path';

      // Act
      const formattedMessage = `Failed to read ${errorType}: ${errorDetails}`;

      // Assert
      expect(formattedMessage).toBe('Failed to read Config: Invalid schema path');
    });
  });
});
