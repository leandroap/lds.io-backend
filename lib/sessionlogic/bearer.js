'use strict';

    // looks for
      // HTTP Authorization Bearer header
      // `access_token` in form field
      // `access_token` URL query param
var BearerStrategy = require('passport-http-bearer').Strategy;

module.exports.create = function (passport, config, AccessTokens, loginWrapper) {

  function tokenLookup(token, done) {
    // TODO JWT (and strict-scope tokens)
    return AccessTokens
      .login(token)
      .then(function ($token) {
        var user;
        var info = { info: true };

        if (!$token) {
          // TODO all Logins need to change to allow additional messages to be passed
          // with the return object (such as a message with 'invalid password')
          done(null, false, { error: { code: "E_INVALID_TOKEN", message: "invalid bearer token" } });
          return;
        }

        // TODO move to AccessToken / JWT layer
        // Note: These token types act as the login which created them
        if (-1 !== [ 'password', 'delegated' ].indexOf($token.get('grantType'))) {
          user = {
            $token: $token
          , $login: $token.$login
          , logins$: [$token.$login]
          , $logins: [$token.$login]
          , accounts$: $token.$login.related('accounts')
          , $accounts: $token.$login.related('accounts')
          , $apikey: $token.related('apikey')
            // TODO pull client from apikey
          , $oauthclient: $token.related('oauthclient')
          , error: null
          };
        } else {
          user = {
            $token: $token
          , $login: $token.$login
          , logins$: [$token.$login]
          , $logins: [$token.$login]
            // TODO check that login is still attached to the account?
          , $account: $token.related('account')
          , $apikey: $token.related('apikey')
            // TODO pull client from apikey
          , $oauthclient: $token.related('oauthclient')
          , error: null
          };
        }

        done(null, user, info);
      }, function () {
        done(null, false, { info: true });
      }).catch(function (err) {
        console.error(err);
        console.warn(err.stack);
        done(err, null, { info: true });
      });
  }

  passport.use(
    'bearer.st'
  , new BearerStrategy(tokenLookup)
  );

  // Yes, custom callbacks have a lot of layers...
  // http://passportjs.org/guide/authenticate/#custom-callback
  //
  // Alternate approach:
  //  rest.get('/api/session/whatevs', passport.authenticate(
  //    'local'
  //  , { failureRedirect: '/login-failed.json'
  //    , successReturnToOrRedirect: '/api/me'
  //    //, successRedirect: '/api/me'
  //    }
  //  ));
  //
  //  negs: has a redirect, can't send specific error, can't manually login
  //  pros: appropriate api redirect will show up in the console
  function createHandleLogin(type) {
    return function handleLogin(req, res, next) {
      function handleSuccessOrFailure(err, user, info) {
        var loginResults
          ;

        if (err) {
          res.error({
            message: "login failed: " + err.toString()
          , code: "INVALID_AUTH_TOKEN"
          });
          return;
        }

        loginResults = {
          error: err
        , user: user
        , info: info
        //, successUrl: '/api/users/me'
        //, successUrl: '/api/session'
        , session: false
        };

        loginWrapper(req, res, next, loginResults);
      }

      passport.authenticate(type, handleSuccessOrFailure)(req, res, next);
    };
  }

  function route(rest) {
    rest.post(
      config.apiPrefix + '/session/bearer'
    , createHandleLogin('bearer.st')
    );
  }

  return {
    route: route
  };
};
