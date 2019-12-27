import Document, { Html, Head, Main, NextScript } from "next/document";

import { TRACKING_ID } from "../lib/fathom";

// CSS is compiled into the style.css below
import "../style.css";

export default class WritingDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html>
        <Head>
          <meta
            name="viewport"
            content="initial-scale=1.0, width=device-width"
            key="viewport"
          />
          <meta charSet="utf-8" />

          <link
            rel="alternate"
            type="application/rss+xml"
            title="RSS Feed"
            href="/feed.rss"
          />
          <link
            rel="alternate"
            type="application/atom+xml"
            title="Atom Feed"
            href="/feed.atom"
          />

          <script
            dangerouslySetInnerHTML={{
              __html: `
            (function(f, a, t, h, o, m){
              a[h]=a[h]||function(){
                (a[h].q=a[h].q||[]).push(arguments)
              };
              o=f.createElement('script'),
              m=f.getElementsByTagName('script')[0];
              o.async=1; o.src=t; o.id='fathom-script';
              m.parentNode.insertBefore(o,m)
            })(document, window, 'https://a.natwelch.com/tracker.js', 'fathom');
            fathom('set', 'siteId', '${TRACKING_ID}');
            fathom('trackPageview');
          `,
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
