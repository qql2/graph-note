# Graph-Note 同步最小实现版本（MVP）

> 用于可行性验证的最小功能实现方案

## 1. MVP 目标和范围

### 1.1 核心目标
- **验证可行性**：证明图数据同步的技术可行性
- **功能最小化**：只实现核心必需功能
- **快速迭代**：2-3周内完成开发和测试
- **架构验证**：验证三阶段同步架构的有效性

### 1.2 功能范围
#### 包含功能
- ✅ 基础的节点和关系同步
- ✅ 简单的冲突检测（时间戳对比）
- ✅ WebDAV后端支持
- ✅ 本地数据库扩展
- ✅ 基础的三阶段同步流程

#### 暂不包含
- ❌ 复杂冲突解决策略
- ❌ 数据加密
- ❌ 多后端支持
- ❌ 性能优化
- ❌ 用户界面集成

## 2. 技术架构简化

### 2.1 数据模型最小扩展
只添加必需的同步字段：

```typescript
// 最小同步字段
interface MinimalSyncMeta {
    version: number;           // 版本号，从1开始
    syncTime: number;          // 最后同步时间戳
    deviceId: string;          // 设备ID
    syncStatus: 'synced' | 'pending' | 'conflict';
    checksum: string;          // 简单的内容哈希
}
```

### 2.2 SQLite 表结构最小扩展
```sql
-- 为现有表添加最小同步字段
ALTER TABLE nodes ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE nodes ADD COLUMN sync_time INTEGER DEFAULT 0;
ALTER TABLE nodes ADD COLUMN device_id TEXT;
ALTER TABLE nodes ADD COLUMN sync_status TEXT DEFAULT 'pending';
ALTER TABLE nodes ADD COLUMN checksum TEXT;

ALTER TABLE relationships ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE relationships ADD COLUMN sync_time INTEGER DEFAULT 0;
ALTER TABLE relationships ADD COLUMN device_id TEXT;
ALTER TABLE relationships ADD COLUMN sync_status TEXT DEFAULT 'pending';
ALTER TABLE relationships ADD COLUMN checksum TEXT;

-- 简单的同步状态表
CREATE TABLE sync_state (
    id INTEGER PRIMARY KEY,
    last_sync_time INTEGER DEFAULT 0,
    device_id TEXT NOT NULL,
    sync_target_config TEXT, -- JSON配置
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

## 3. 核心组件最小实现

### 3.1 同步引擎核心
```typescript
// 最小同步引擎
class MinimalSyncEngine {
    // 核心三阶段同步
    async performSync(): Promise<SyncResult> {
        try {
            // 阶段1：上传本地变更
            await this.uploadLocalChanges();
            
            // 阶段2：删除远程已删除项
            await this.deleteRemoteItems();
            
            // 阶段3：下载远程变更
            await this.downloadRemoteChanges();
            
            return { success: true, conflicts: [] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // 简化的冲突检测
    private detectConflict(local: any, remote: any): boolean {
        return local.sync_time > 0 && 
               remote.updated_time > local.sync_time &&
               local.checksum !== remote.checksum;
    }
}
```

### 3.2 WebDAV 最小实现
```typescript
// 最小WebDAV客户端
class MinimalWebDAVClient {
    // 基础CRUD操作
    async get(path: string): Promise<string> { /* 实现 */ }
    async put(path: string, content: string): Promise<void> { /* 实现 */ }
    async delete(path: string): Promise<void> { /* 实现 */ }
    async list(path: string): Promise<RemoteItem[]> { /* 实现 */ }
    
    // 简化的增量同步（无优化）
    async getDelta(): Promise<RemoteItem[]> {
        // 直接返回所有文件列表，由客户端对比
        return await this.list('/graph-data/');
    }
}
```

### 3.3 文件格式简化
```json
// 节点文件格式（nodes/node-{id}.json）
{
    "id": "node-123",
    "label": "示例节点",
    "properties": { "type": "concept" },
    "created_at": 1234567890,
    "updated_at": 1234567891,
    "version": 1,
    "sync_time": 1234567891,
    "device_id": "device-abc",
    "checksum": "hash123"
}

// 关系文件格式（relationships/rel-{id}.json）
{
    "id": "rel-456",
    "source_id": "node-123",
    "target_id": "node-789",
    "label": "relates_to",
    "properties": {},
    "created_at": 1234567890,
    "updated_at": 1234567891,
    "version": 1,
    "sync_time": 1234567891,
    "device_id": "device-abc",
    "checksum": "hash456"
}
```

## 4. 实现步骤

### 4.1 第一周：基础设施
1. **数据库扩展**（1天）
   - 添加同步字段到现有表
   - 创建同步状态表
   - 更新数据访问层

2. **WebDAV客户端**（2天）
   - 基础HTTP WebDAV操作
   - 简单的错误处理
   - 连接测试功能

3. **数据序列化**（1天）
   - 图数据JSON序列化
   - 校验和计算
   - 基础数据验证

4. **同步引擎框架**（1天）
   - 三阶段同步框架
   - 基础状态管理
   - 错误处理机制

### 4.2 第二周：核心同步逻辑
1. **上传阶段实现**（2天）
   - 获取本地待同步数据
   - 基础冲突检测
   - 文件上传逻辑

2. **下载阶段实现**（2天）
   - 远程文件列表获取
   - 本地应用远程变更
   - 简单的依赖处理

3. **删除阶段实现**（1天）
   - 远程删除操作
   - 本地删除标记处理

### 4.3 第三周：测试和优化
1. **单元测试**（2天）
   - 核心同步逻辑测试
   - 冲突检测测试
   - 数据完整性测试

2. **集成测试**（2天）
   - 端到端同步测试
   - 多设备模拟测试
   - 错误场景测试

3. **基础性能测试**（1天）
   - 小规模数据同步测试
   - 网络异常处理测试

## 5. 验证指标

### 5.1 功能指标
- ✅ 单设备基础同步成功率 > 95%
- ✅ 简单冲突检测准确率 > 90%
- ✅ 数据完整性保持 100%
- ✅ 基础错误恢复能力

### 5.2 性能指标
- ✅ 100个节点同步时间 < 30秒
- ✅ 网络中断恢复时间 < 10秒
- ✅ 内存使用增长 < 50MB

### 5.3 稳定性指标
- ✅ 连续同步24小时无崩溃
- ✅ 网络异常处理成功率 > 80%
- ✅ 数据损坏率 < 0.1%

## 6. 风险和限制

### 6.1 已知限制
- **性能限制**：未优化，大数据量可能较慢
- **冲突处理简陋**：只有基础的时间戳比较
- **错误恢复有限**：只有基础的重试机制
- **无用户界面**：需要手动触发同步

### 6.2 技术风险
- **WebDAV兼容性**：不同服务商的兼容性问题
- **并发冲突**：多设备同时修改的复杂场景
- **数据一致性**：图数据引用完整性保证
- **网络稳定性**：弱网环境下的同步可靠性

### 6.3 风险缓解
- **分阶段测试**：从小数据量开始测试
- **数据备份**：测试期间定期备份数据
- **回滚机制**：出问题时的数据回滚方案
- **监控日志**：详细的操作日志记录

## 7. 成功标准

### 7.1 技术验证成功标准
- 基础同步流程完整运行
- 简单冲突场景正确处理
- 数据完整性得到保证
- 网络异常基本恢复

### 7.2 项目继续标准
- 所有核心功能测试通过
- 性能指标达到要求
- 稳定性测试无重大问题
- 团队对技术方案有信心

### 7.3 项目停止标准
- 核心技术问题无法解决
- 性能表现远低于预期
- 数据安全风险过高
- 开发复杂度超出预期

## 8. 下一步计划

### 8.1 MVP成功后的优化方向
1. **性能优化**：增量同步、批量操作
2. **冲突处理增强**：智能合并、用户选择
3. **多后端支持**：OneDrive、Dropbox等
4. **用户界面集成**：同步状态显示、设置界面
5. **数据加密**：可选的端到端加密

### 8.2 产品化路径
1. **用户体验优化**：自动同步、进度显示
2. **企业功能**：团队协作、权限管理
3. **平台扩展**：移动端、Web端支持
4. **高级功能**：版本历史、数据分析

---

## 附录：开发检查清单

### Phase 1: 基础设施
- [ ] 数据库schema扩展完成
- [ ] WebDAV客户端基础功能
- [ ] 数据序列化和校验
- [ ] 同步引擎框架搭建

### Phase 2: 核心逻辑
- [ ] 上传阶段实现
- [ ] 下载阶段实现  
- [ ] 删除阶段实现
- [ ] 基础冲突检测

### Phase 3: 测试验证
- [ ] 单元测试覆盖 > 80%
- [ ] 集成测试通过
- [ ] 性能测试达标
- [ ] 稳定性测试通过

### 交付物
- [ ] 可运行的最小同步系统
- [ ] 完整的测试报告
- [ ] 技术方案验证报告
- [ ] 后续优化建议

---

*本MVP方案专注于快速验证可行性，为后续完整实现奠定基础*
