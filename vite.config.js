
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  appType: "mpa",

  plugins: [
    {
      name: "admin-route-redirect",

      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const pathname = req.url?.split("?")[0];

          if (pathname === "/admin") {
            res.statusCode = 302;
            res.setHeader(
              "Location",
              "/admin/" +
                (req.url.includes("?")
                  ? req.url.slice(req.url.indexOf("?"))
                  : "")
            );
            res.end();
            return;
          }

          next();
        });
      }
    }
  ],

  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        admin: resolve(process.cwd(), "admin/index.html")
      }
    }
  }
});
