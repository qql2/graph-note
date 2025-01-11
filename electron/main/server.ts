import Koa from "koa";
import Router from "koa-router";
import serve from "koa-static";
import path from "path";
import { Server } from "http";
import { Context, Next } from "koa";

export class AppServer {
  private app: Koa;
  private router: Router;
  private server: Server | null = null;

  constructor() {
    this.app = new Koa();
    this.router = new Router();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // 静态文件服务
    if (process.env.NODE_ENV === "production") {
      this.app.use(serve(path.join(__dirname, "../dist")));
    }

    // 错误处理
    this.app.use(async (ctx: Context, next: Next) => {
      try {
        await next();
      } catch (err) {
        const error = err as Error;
        ctx.status = 500;
        ctx.body = {
          success: false,
          error: error.message,
        };
        ctx.app.emit("error", error, ctx);
      }
    });
  }

  private setupRoutes() {
    // API 路由
    this.router.get("/api/health", async (ctx: Context) => {
      ctx.body = {
        status: "ok",
        timestamp: new Date().toISOString(),
      };
    });

    // 应用路由到应用
    this.app.use(this.router.routes());
    this.app.use(this.router.allowedMethods());

    // 所有未匹配的路由返回 index.html
    this.app.use(async (ctx: Context) => {
      if (process.env.NODE_ENV === "production") {
        ctx.path = "index.html";
        await serve(path.join(__dirname, "../dist"))(ctx, () =>
          Promise.resolve()
        );
      }
    });
  }

  public async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        resolve();
      });
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
