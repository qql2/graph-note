import { vi } from "vitest";

// 创建一个可靠的localStorage mock
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();

// 替换全局的localStorage
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// 模拟SQLite服务
vi.mock("../../sqliteService", () => {
  const mockConnection = {
    query: vi.fn(),
    run: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    isDBOpen: vi.fn().mockResolvedValue(true),
  };

  return {
    default: {
      getPlatform: vi.fn().mockReturnValue("web"),
      initWebStore: vi.fn().mockResolvedValue(undefined),
      openDatabase: vi.fn().mockResolvedValue(mockConnection),
      closeDatabase: vi.fn().mockResolvedValue(undefined),
      saveToStore: vi.fn().mockResolvedValue(undefined),
      saveToLocalDisk: vi.fn().mockResolvedValue(undefined),
      isConnection: vi.fn().mockResolvedValue({ result: true }),
      transaction: vi.fn().mockImplementation(async (_, cb) => {
        return await cb(mockConnection);
      }),
      getMockConnection: () => mockConnection,
    },
  };
}); 