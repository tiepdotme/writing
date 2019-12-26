import Error from "next/error";
import Head from "next/head";
import React from "react";
import { withRouter } from "next/router";

import AdminLinkList from "../../components/AdminLinkList";
import App from "../../components/App";
import EditPost from "../../components/EditPost";
import Header from "../../components/Header";
import NotAuthorized from "../../components/NotAuthorized";
import { checkLoggedIn } from "../../lib/auth";
import withError from "../../lib/withError";

const Page = withError(props => {
  if (
    !props.loggedInUser ||
    !props.loggedInUser.role ||
    props.loggedInUser.role !== "admin"
  ) {
    return <NotAuthorized />;
  }
  return (
    <App>
      <Head>
        <title>Nat? Nat. Nat! Edit Post #{this.props.router.query.pid}</title>
      </Head>
      <Header noLogo loggedInUser={this.state.loggedInUser} />
      <EditPost id={this.props.router.query.pid} />
      <AdminLinkList />
    </App>
  );
});

Page.getInitialProps = async ctx => {
  const { loggedInUser } = await checkLoggedIn(ctx.apolloClient);
  let ret = { loggedInUser };
  return ret;
};

export default Page;
