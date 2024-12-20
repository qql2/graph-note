const Koa = require('koa');
const serve = require('koa-static');
const Router = require('koa-router');
const path = require('path');

class AppServer {
  constructor() {
    this.app = new Koa();
    this.router = new Router();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(serve(path.join(__dirname, '../dist')));
  }

  setupRoutes() {
    // 在这里添加 API 路由
    this.app.use(this.router.routes());
  }

  start(port) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        resolve();
      });
    });
  }
}

module.exports = AppServer; 