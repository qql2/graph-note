// 导出核心类型和接口
export * from "./core/types";
export * from "./core/errors";

// 导出数据库服务实例
export { default as graphDatabaseService } from "./GraphDatabaseService";

// 导出具体实现类
export { SQLiteGraphDB } from "./platforms/SQLiteGraphDB";

// 默认导出数据库服务实例
import graphDatabaseService from "./GraphDatabaseService";
export default graphDatabaseService; 