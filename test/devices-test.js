'use strict';

var test = require('tap').test
var LamassuConfig = require('../lib/main');
var con = 'psql://lamassu:lamassu@localhost/lamassu';

var authorized = 'CB:3D:78:49:03:39:BA:47:0A:33:29:3E:31:25:F7:C6:4F:74:71:D7';

test('authorize and check authorization', function(t){
  var config = new LamassuConfig(con, 1);

  t.plan(18);

  config.isAuthorized('AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:4F:74:71:D7', function(err, authorized) {
    t.equal(err, null, 'There should be no error.');
    t.equal(authorized, false, 'device should not be authorized');
  });

  // Operator starts a pairing in the admin panel. Pairing token is created
  // and packed up into a QR code with the lamassu-server URL.
  config.createPairingToken(function(err, token) {
    t.equal(err, null, 'There should be no error when creating a pairing token');
    t.type(token, 'string', 'token should be a string');

    config.pair(token, authorized, 'bar', function(err) {
      t.equal(err, null, 'There should be no error');

      config.isAuthorized(authorized, function(err, isAuthorized) {
        t.equal(err, null, 'There should be no error when checking authorization');
        t.equal(isAuthorized, false, 'device just paired should come up as not authorized');

        config.authorize(authorized, function(err) {
          t.equal(err, null, 'There should be no error when authorizing the device');

          config.isAuthorized(authorized, function(err, isAuthorized) {
            t.equal(err, null, 'There should be no error when checking authorization');
            t.equal(isAuthorized, true, 'device just authorized should come up as authorized');

            config.deauthorize(authorized, function(err) {
              t.equal(err, null, 'There should be no error when deauthorizing');

              config.isAuthorized(authorized, function(err, authorized) {
                t.equal(err, null, 'There should be no error when checking authorization');
                t.equal(authorized, false, 'device just deauthorized should come up as deauthorized');
              });
            });
          });
        });
      });
    });

    config.pair('foo', authorized, 'bar', function(err) {
      t.ok(err, 'There should be an error when pairing with invalid token');
    });
  });

  config.createPairingToken(function(err, token) {
    t.equal(err, null, 'There should be no error when creating a pairing token');

    setTimeout(function() {
      config.cleanExpiredPairingTokens(function(err) {
        t.equal(err, null, 'There should be no error when cleaning expired pairing tokens');

        config.pair(token, authorized, 'restaurant', function(err) {
          t.ok(err, 'There should be an error when trying to pair with an expired token');
          t.equal(err.message, 'Token not found', 'Token should be not found');
        });
      });
    }, 2000);
  });

  t.on('end', function () {
    config.end();
  });
});
