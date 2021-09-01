import * as R from 'ramda'
import * as React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import Placeholder from 'components/Placeholder'
import SyncDownload from 'containers/SyncDownload'
import SyncHome from 'containers/SyncHome'
import requireAuth from 'containers/Auth/wrapper'
import { CatchNotFound, ThrowNotFound } from 'containers/NotFoundPage'
import { isAdmin } from 'containers/Auth/selectors'
import { loadable } from 'utils/reactTools'
import { useLocation } from 'utils/router'

import * as AwsReadiness from './AwsReadiness'

const redirectTo =
  (path: string) =>
  ({ location: { search } }: { location: { search: string } }) =>
    <Redirect to={`${path}${search}`} />

const requireAdmin = (requireAuth as $TSFixMe)({ authorizedSelector: isAdmin })

const mkLazy = (load: $TSFixMe) =>
  (loadable as $TSFixMe)(load, { fallback: () => <Placeholder /> })

const Admin = mkLazy(() => import('containers/Admin'))
const AuthActivationError = mkLazy(() => import('containers/Auth/ActivationError'))
const AuthCode = requireAuth()(mkLazy(() => import('containers/Auth/Code')))
const AuthPassChange = mkLazy(() => import('containers/Auth/PassChange'))
const AuthPassReset = mkLazy(() => import('containers/Auth/PassReset'))
const AuthSSOSignUp = mkLazy(() => import('containers/Auth/SSOSignUp'))
const AuthSignIn = mkLazy(() => import('containers/Auth/SignIn'))
const AuthSignOut = mkLazy(() => import('containers/Auth/SignOut'))
const AuthSignUp = mkLazy(() => import('containers/Auth/SignUp'))
const Bucket = mkLazy(() => import('containers/Bucket'))

export default function App() {
  const cfg = Config.useConfig()
  const protect = React.useMemo(
    () => (cfg.alwaysRequiresAuth ? requireAuth() : R.identity),
    [cfg.alwaysRequiresAuth],
  )
  const { paths, urls } = NamedRoutes.use()
  const l = useLocation()

  const [isAwsReady, awsReadyState] = AwsReadiness.use()
  if (!isAwsReady) return <AwsReadiness.Placeholder state={awsReadyState} />

  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Switch>
        <Route path={paths.home} component={protect(SyncHome)} exact />

        {!cfg.disableNavigator && (
          <Route path={paths.syncDownload} component={protect(SyncDownload)} />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.admin} component={requireAdmin(Admin)} />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.bucketRoot} component={protect(Bucket)} />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.signIn} component={AuthSignIn} exact />
        )}
        {!cfg.disableNavigator && (
          <Route path="/login" component={redirectTo(urls.signIn())} exact />
        )}
        {!cfg.disableNavigator && (
          <Route path={paths.signOut} component={AuthSignOut} exact />
        )}
        {!cfg.disableNavigator && (cfg.passwordAuth === true || cfg.ssoAuth === true) && (
          <Route path={paths.signUp} component={AuthSignUp} exact />
        )}
        {!cfg.disableNavigator && cfg.ssoAuth === true && (
          <Route path={paths.ssoSignUp} component={AuthSSOSignUp} exact />
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <Route path={paths.passReset} component={AuthPassReset} exact />
        )}
        {!cfg.disableNavigator && !!cfg.passwordAuth && (
          <Route path={paths.passChange} component={AuthPassChange} exact />
        )}
        {!cfg.disableNavigator && <Route path={paths.code} component={AuthCode} exact />}
        {!cfg.disableNavigator && (
          <Route path={paths.activationError} component={AuthActivationError} exact />
        )}

        <Route component={protect(ThrowNotFound)} />
      </Switch>
    </CatchNotFound>
  )
}
