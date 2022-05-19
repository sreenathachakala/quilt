import * as R from 'ramda'
import * as React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import Placeholder from 'components/Placeholder'
import requireAuth from 'containers/Auth/wrapper'
import { CatchNotFound, ThrowNotFound } from 'containers/NotFoundPage'
import { isAdmin } from 'containers/Auth/selectors'
import * as RT from 'utils/reactTools'
import { useLocation } from 'utils/router'

import * as CliReadiness from './CliReadiness'
import Lock from './Lock'

const redirectTo =
  (path: string) =>
  ({ location: { search } }: { location: { search: string } }) =>
    <Redirect to={`${path}${search}`} />

const requireAdmin = (requireAuth as $TSFixMe)({ authorizedSelector: isAdmin })

const Admin = RT.mkLazy(() => import('containers/Admin'), Placeholder)
const AuthActivationError = RT.mkLazy(
  () => import('containers/Auth/ActivationError'),
  Placeholder,
)
const AuthCode = requireAuth()(
  RT.mkLazy(() => import('containers/Auth/Code'), Placeholder),
)
const AuthPassChange = RT.mkLazy(() => import('containers/Auth/PassChange'), Placeholder)
const AuthPassReset = RT.mkLazy(() => import('containers/Auth/PassReset'), Placeholder)
const AuthSSOSignUp = RT.mkLazy(() => import('containers/Auth/SSOSignUp'), Placeholder)
const AuthSignIn = RT.mkLazy(() => import('containers/Auth/SignIn'), Placeholder)
const AuthSignOut = RT.mkLazy(() => import('containers/Auth/SignOut'), Placeholder)
const AuthSignUp = RT.mkLazy(() => import('containers/Auth/SignUp'), Placeholder)
const Bucket = RT.mkLazy(() => import('containers/Bucket'), Placeholder)
const UriResolver = RT.mkLazy(() => import('containers/UriResolver'), Placeholder)

const Landing = RT.mkLazy(() => import('website/pages/Landing'), Placeholder)

export default function App() {
  const cfg = Config.useConfig()
  const protect = React.useMemo(
    () => (cfg.alwaysRequiresAuth ? requireAuth() : R.identity),
    [cfg.alwaysRequiresAuth],
  )
  const { paths, urls } = NamedRoutes.use()
  const l = useLocation()

  const [isAwsReady, awsReadyState] = CliReadiness.use()
  if (!isAwsReady) return <CliReadiness.Placeholder state={awsReadyState} />

  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Lock />
      <Switch>
        <Route path={paths.home} component={protect(Landing)} exact />

        {!cfg.disableNavigator && (
          <Route path={paths.admin} component={requireAdmin(Admin)} />
        )}

        {!cfg.disableNavigator && (
          <Route path={paths.uriResolver} component={protect(UriResolver)} />
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
