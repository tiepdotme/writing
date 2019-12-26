"use strict";

const {
  SSLMiddleware,
  NELMiddleware,
  ReportToMiddleware,
} = require("@icco/react-common");
const compression = require("compression");
const express = require("express");
const helmet = require("helmet");
const expectCt = require("expect-ct");
const next = require("next");
const rss = require("feed");
const gql = require("graphql-tag");
const { parse } = require("url");
const { join } = require("path");
const opencensus = require("@opencensus/core");
const tracing = require("@opencensus/nodejs");
const stackdriver = require("@opencensus/exporter-stackdriver");
const propagation = require("@opencensus/propagation-stackdriver");
const pinoMiddleware = require("pino-http");

const md = require("./lib/markdown.js");
const apollo = require("./lib/init-apollo.js");
const { logger } = require("./lib/logger.js");

const GOOGLE_PROJECT = "icco-cloud";
const port = parseInt(process.env.PORT, 10) || 8080;

async function recentPosts() {
  try {
    const client = apollo.create({}, {});
    let res = await client.query({
      query: gql`
        query recentPosts {
          posts(input: { limit: 20, offset: 0 }) {
            id
            title
            datetime
            summary
          }
        }
      `,
    });

    return res.data.posts;
  } catch (err) {
    logger.error(err);
    return [];
  }
}

async function generateFeed() {
  let feed = new rss.Feed({
    title: "Nat? Nat. Nat!",
    favicon: "https://writing.natwelch.com/favicon.ico",
    description: "Nat Welch's blog about random stuff.",
    feedLinks: {
      atom: "https://writing.natwelch.com/feed.atom",
    },
    author: {
      name: "Nat Welch",
      email: "nat@natwelch.com",
      link: "https://natwelch.com",
    },
    language: "en",
  });

  try {
    let data = await recentPosts();

    data.forEach(p => {
      feed.addItem({
        title: p.title,
        link: `https://writing.natwelch.com/post/${p.id}`,
        date: new Date(p.datetime),
        content: md.render(p.summary),
        author: [
          {
            name: "Nat Welch",
            email: "nat@natwelch.com",
            link: "https://natwelch.com",
          },
        ],
      });
    });
  } catch (err) {
    logger.error(err);
  }

  return feed;
}

async function startServer() {
  if (process.env.ENABLE_STACKDRIVER) {
    const sse = new stackdriver.StackdriverStatsExporter({
      projectId: GOOGLE_PROJECT,
    });
    opencensus.globalStats.registerExporter(sse);

    const sp = propagation.v1;
    const ste = new stackdriver.StackdriverTraceExporter({
      projectId: GOOGLE_PROJECT,
    });
    const tracer = tracing.start({
      samplingRate: 1,
      logger: logger,
      exporter: ste,
      propagation: sp,
    }).tracer;

    tracer.startRootSpan({ name: "init" }, rootSpan => {
      for (let i = 0; i < 1000000; i++) {}

      rootSpan.end();
    });
  }

  const app = next({
    dir: ".",
    dev: process.env.NODE_ENV !== "production",
  });

  app
    .prepare()
    .then(() => {
      const server = express();
      server.set("trust proxy", true);
      server.set("x-powered-by", false);

      server.use(
        pinoMiddleware({
          logger,
        })
      );

      server.use(NELMiddleware());
      server.use(ReportToMiddleware("writing"));

      server.use(helmet());

      server.use(
        helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" })
      );

      server.use(
        helmet.contentSecurityPolicy({
          directives: {
            upgradeInsecureRequests: true,

            //  default-src 'none'
            defaultSrc: [
              "'self'",
              "https://graphql.natwelch.com/graphql",
              "https://graphql.natwelch.com/photo/new",
              "https://icco.auth0.com/.well-known/jwks.json",
            ],
            // style-src 'self' 'unsafe-inline' https://fonts.googleapis.com/
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com/",
            ],
            // font-src https://fonts.gstatic.com
            fontSrc: ["https://fonts.gstatic.com"],
            // img-src 'self' data: http://a.natwelch.com https://a.natwelch.com https://icco.imgix.net
            imgSrc: [
              "'self'",
              "blob:",
              "data:",
              "https://a.natwelch.com",
              "https://icco.imgix.net",
              "https://storage.googleapis.com",
              "https://writing.natwelch.com",
            ],
            // script-src 'self' 'unsafe-eval' 'unsafe-inline' http://a.natwelch.com/tracker.js https://a.natwelch.com/tracker.js
            scriptSrc: [
              "'self'",
              "'unsafe-inline'",
              "'unsafe-eval'",
              "https://a.natwelch.com/tracker.js",
            ],
            // object-src 'none';
            objectSrc: ["'none'"],
            // https://developers.google.com/web/updates/2018/09/reportingapi#csp
            reportUri: "https://reportd.natwelch.com/report/writing",
            reportTo: "default",
          },
        })
      );

      server.use(expectCt({ maxAge: 123 }));

      server.use(compression());

      server.use(SSLMiddleware());

      server.get("/healthz", (req, res) => {
        res.json({ status: "ok" });
      });

      server.get("/about", (req, res) => {
        res.redirect("https://natwelch.com");
      });

      server.get("/feed.rss", async (req, res) => {
        let feed = await generateFeed();
        res.set("Content-Type", "application/rss+xml");
        res.send(feed.rss2());
      });

      server.get("/feed.atom", async (req, res) => {
        let feed = await generateFeed();
        res.set("Content-Type", "application/atom+xml");
        res.send(feed.atom1());
      });

      server.get("/sitemap.xml", async (req, res) => {
        let sm = await generateSitemap();
        sm.toXML(function(err, xml) {
          if (err) {
            logger.error(err);
            return res.status(500).end();
          }
          res.header("Content-Type", "application/xml");
          res.send(xml);
        });
      });

      server.all("*", (req, res) => {
        const handle = app.getRequestHandler();
        const parsedUrl = parse(req.url, true);

        const redirects = {};

        if (parsedUrl.pathname in redirects) {
          return res.redirect(redirects[parsedUrl.pathname]);
        }

        return handle(req, res, parsedUrl);
      });

      server.listen(port, err => {
        if (err) throw err;
      });
    })
    .catch(ex => {
      logger.error(ex);
      process.exit(1);
    });
}

logger.info(`> Ready on http://localhost:${port}`);
startServer();
