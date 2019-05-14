import Document, { Head, Main, NextScript } from "next/document";

import { TRACKING_ID } from "../lib/fathom";
import { checkLoggedIn } from "../lib/auth";

export default class WritingDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const { loggedInUser } = await checkLoggedIn(ctx.apolloClient);

    return {
      ...initialProps,
      loggedInUser,
      currentUrl: ctx.pathname,
      isAuthenticated: !!loggedInUser,
    };
  }

  render() {
    return (
      <html lang="en">
        <Head>
          <meta
            name="viewport"
            content="initial-scale=1.0, width=device-width"
            key="viewport"
          />
          <meta charSet="utf-8" />

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
            })(document, window, '//a.natwelch.com/tracker.js', 'fathom');
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
      </html>
    );
  }
}
