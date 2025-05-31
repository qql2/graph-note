# Ionic + Electron + SQLite 跨平台集成简要说明

本项目基于 [Ionic7/React + @capacitor-community/sqlite + jeep-sqlite](https://jepiqueau.github.io/2023/08/31/Ionic7React-SQLite-CRUD-App.html#run-the-electron-app) 官方模板，支持 Web、Android、iOS、Electron 跨平台本地数据库。

## 技术要点
- 前端框架：Ionic 7 + React
- 数据库：@capacitor-community/sqlite（统一 API）
- Web 端适配：jeep-sqlite
- Electron 端适配：@capacitor-community/electron 插件

## 数据库适配说明
- **Web 端**：通过 jeep-sqlite 让 @capacitor-community/sqlite 在浏览器下可用，API 与原生一致。
- **Electron 端**：通过 @capacitor-community/electron 插件，数据库文件本地存储，API 与移动端一致。
- **移动端**：原生 SQLite。

## 主要开发流程
- 依赖安装：
  - 仅需安装 @capacitor-community/sqlite、jeep-sqlite、@capacitor-community/electron 及 Electron 相关依赖。
- 开发/调试：
  - Web 端：`npm run dev`
  - Electron 端：`npm run electron:start`
  - 移动端：`npm run android:start` 或 `npm run ios:start`
- 打包发布：
  - Electron 端：`npm run electron:make`

## 关键配置提示
- package.json 脚本需区分 web/native 构建，electron 相关命令需准备好 electron 目录和依赖。
- capacitor.config.ts 需配置好各平台数据库路径和插件参数。

## 常见问题
- 路径与静态资源：开发环境用绝对路径，生产环境用相对路径。
- 数据库升级：通过 upgrade statements 管理版本。
- 性能优化：合理使用事务、批量操作。

## 参考链接
- [官方教程](https://jepiqueau.github.io/2023/08/31/Ionic7React-SQLite-CRUD-App.html#run-the-electron-app)
- [@capacitor-community/sqlite](https://github.com/capacitor-community/sqlite)
- [jeep-sqlite](https://github.com/jepiqueau/jeep-sqlite)
- [Electron](https://www.electronjs.org/docs)
- [Ionic Framework](https://ionicframework.com/docs)

